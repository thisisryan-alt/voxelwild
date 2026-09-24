#ifndef VOXELWILD_TERRAIN_SURFACE_INCLUDED
#define VOXELWILD_TERRAIN_SURFACE_INCLUDED

// Terrain material inputs and surface evaluation (used by every Voxelwild/Terrain pass).
#include "Assets/Shaders/Include/VoxelCommon.hlsl"

TEXTURE2D_ARRAY(_AlbedoArray);  SAMPLER(sampler_AlbedoArray);
TEXTURE2D_ARRAY(_NormalArray);
TEXTURE2D_ARRAY(_MaskArray);

CBUFFER_START(UnityPerMaterial)
    float _BevelWidth;
    float _BevelStrength;
    float _EdgeWear;
    float _VoxelAOStrength;
    float _VoxelAODirect;
    float _GrassOverhang;
CBUFFER_END

// Per-layer tuning from TerrainLayerProfile: x = uv scale, y = normal strength, z = roughness scale, w = macro variation
float4 _VoxelLayerParams[32];
float4 _VoxelLayerTint[32];

struct VoxelSurface
{
    float3 albedo;
    float3 normalWS;
    float roughness;
    float metallic;
    float occlusion;     // texture AO x voxel AO
    float directShade;   // portion of voxel AO applied to direct light as well
};

struct LayerSample
{
    float3 albedo;
    float height;
    float3 normalTS;
    float ao;
    float roughness;
    float metallic;
};

LayerSample SampleLayer(uint layer, float2 uvBlocks)
{
    float4 lp = _VoxelLayerParams[layer];
    float2 uv = uvBlocks * lp.x;
    float4 a = SAMPLE_TEXTURE2D_ARRAY(_AlbedoArray, sampler_AlbedoArray, uv, layer);
    float4 n = SAMPLE_TEXTURE2D_ARRAY(_NormalArray, sampler_AlbedoArray, uv, layer);
    float4 m = SAMPLE_TEXTURE2D_ARRAY(_MaskArray, sampler_AlbedoArray, uv, layer);

    LayerSample s;
    s.albedo = a.rgb * _VoxelLayerTint[layer].rgb;
    s.height = a.a;
    s.normalTS = n.xyz * 2.0 - 1.0;
    s.normalTS.xy *= lp.y;
    s.normalTS = normalize(s.normalTS);
    s.ao = m.r;
    s.roughness = saturate(m.g * lp.z);
    s.metallic = m.b;
    return s;
}

// Full material evaluation for a terrain fragment: texture layers, grass overhang on block sides,
// macro variation, bevelled convex block edges and voxel AO.
VoxelSurface EvaluateVoxelSurface(float3 positionWS, VoxelVertexData v)
{
    float3 N = kFaceN[v.face];
    float3 T = kFaceT[v.face];
    float3 B = kFaceB[v.face];

    // Continuous world-space mapping across coplanar faces (textures span blocks per layer settings).
    float2 uvBlocks = float2(dot(positionWS, T), dot(positionWS, B));

    // Block-local coordinates in [0,1] along T and B, used for bevels and the grass overhang.
    float3 cell = floor(positionWS - N * 0.5);
    float3 local = positionWS - cell;
    float u = dot(local - 0.5, T) + 0.5;
    float w = dot(local - 0.5, B) + 0.5;

    LayerSample s = SampleLayer(v.layer, uvBlocks);

    if (v.overlay != 255u)
    {
        // Grass creeping over the top of dirt block sides with a ragged, height-driven edge.
        LayerSample o = SampleLayer(v.overlay, uvBlocks);
        float jitter = VoxelHash21(cell.xz + cell.y * 17.0) - 0.5;
        float edge = 1.0 - _GrassOverhang + (o.height - 0.5) * 0.28 + jitter * 0.06;
        float m = smoothstep(edge - 0.035, edge + 0.035, w);
        float shadowBand = smoothstep(edge - 0.22, edge, w) * (1.0 - m);
        s.albedo = lerp(s.albedo * (1.0 - 0.3 * shadowBand), o.albedo, m);
        s.normalTS = normalize(lerp(s.normalTS, o.normalTS, m));
        s.ao = lerp(s.ao * (1.0 - 0.35 * shadowBand), o.ao, m);
        s.roughness = lerp(s.roughness, o.roughness, m);
        s.metallic = lerp(s.metallic, o.metallic, m);
    }

    // Low-frequency variation breaks up tiling over large areas.
    float macroAmount = _VoxelLayerParams[v.layer].w;
    float2 mp = positionWS.xz + positionWS.y * float2(0.37, -0.21);
    float macro = VoxelValueNoise(mp * 0.035) * 0.65 + VoxelValueNoise(mp * 0.11 + 13.1) * 0.35;
    s.albedo *= lerp(1.0, 0.8 + 0.4 * macro, macroAmount);

    float3 normalWS = normalize(T * s.normalTS.x + B * s.normalTS.y + N * s.normalTS.z);

    // Bevel: bend the normal toward exposed edges. Fades out once the bevel is under ~2 pixels wide.
    float bw = _BevelWidth;
    float px = max(max(fwidth(u), fwidth(w)), 1e-5);
    float bevelFade = saturate(bw / px * 0.5 - 0.5);
    float3 tilt = 0;
    float edgeAmt = 0;
    float t;
    t = (v.edges & 1u) ? saturate(1.0 - u / bw) : 0.0;          tilt -= T * t; edgeAmt = max(edgeAmt, t);
    t = (v.edges & 2u) ? saturate(1.0 - (1.0 - u) / bw) : 0.0;  tilt += T * t; edgeAmt = max(edgeAmt, t);
    t = (v.edges & 4u) ? saturate(1.0 - w / bw) : 0.0;          tilt -= B * t; edgeAmt = max(edgeAmt, t);
    t = (v.edges & 8u) ? saturate(1.0 - (1.0 - w) / bw) : 0.0;  tilt += B * t; edgeAmt = max(edgeAmt, t);
    tilt *= _BevelStrength * bevelFade;
    normalWS = normalize(normalWS + tilt * 1.3);

    float wear = edgeAmt * edgeAmt * _EdgeWear * bevelFade;
    s.albedo = lerp(s.albedo, s.albedo * 1.3 + 0.02, wear);
    s.roughness = lerp(s.roughness, saturate(s.roughness + 0.2), wear);

    // Voxel AO: smooth the 4-level corner value into a soft contact shadow.
    float vao = lerp(0.28, 1.0, smoothstep(0.0, 1.0, v.ao));
    vao = lerp(1.0, vao, _VoxelAOStrength);

    VoxelSurface o;
    o.albedo = s.albedo;
    o.normalWS = normalWS;
    o.roughness = s.roughness;
    o.metallic = s.metallic;
    o.occlusion = s.ao * vao;
    o.directShade = lerp(1.0, vao, _VoxelAODirect);
    return o;
}

#endif
