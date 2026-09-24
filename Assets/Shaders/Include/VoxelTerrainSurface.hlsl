#ifndef VOXELWILD_TERRAIN_SURFACE_INCLUDED
#define VOXELWILD_TERRAIN_SURFACE_INCLUDED

// Terrain / foliage material inputs and surface evaluation.
#include "Assets/Shaders/Include/VoxelCommon.hlsl"

TEXTURE2D_ARRAY(_AlbedoArray);  SAMPLER(sampler_AlbedoArray);
TEXTURE2D_ARRAY(_NormalArray);  SAMPLER(sampler_NormalArray);
TEXTURE2D_ARRAY(_MaskArray);

CBUFFER_START(UnityPerMaterial)
    float _BevelWidth;
    float _BevelStrength;
    float _EdgeWear;
    float _VoxelAOStrength;
    float _VoxelAODirect;
    float _GrassOverhang;
    float _Cutoff;
    float _Translucency;
CBUFFER_END

// Per-layer tuning from TerrainLayerProfile (index = TextureLayer):
//   Params  x = uv scale, y = normal strength, z = roughness scale, w = macro variation
//   Tint    rgb = colour multiplier, w = specular reflectance scale
//   Params2 x = emission intensity, y = translucency, z = biome-tintable (0/1), w = alpha is opacity (0/1)
float4 _VoxelLayerParams[64];
float4 _VoxelLayerTint[64];
float4 _VoxelLayerParams2[64];

struct VoxelSurface
{
    float3 albedo;
    float3 normalWS;
    float roughness;
    float metallic;
    float occlusion;     // texture AO x voxel AO
    float directShade;   // portion of voxel AO applied to direct light as well
    float alpha;         // opacity for cutout layers, 1 otherwise
    float3 emission;
    float translucency;
    float specular;      // reflectance scale
};

struct LayerSample
{
    float3 albedo;
    float alpha;         // height, or opacity for cutout layers
    float3 normalTS;
    float ao;
    float roughness;
    float metallic;
    float emission;
};

LayerSample SampleLayer(uint layer, float2 uv, VoxelVertex v)
{
    float4 lp = _VoxelLayerParams[layer];
    float4 a = SAMPLE_TEXTURE2D_ARRAY(_AlbedoArray, sampler_AlbedoArray, uv, layer);
    float4 n = SAMPLE_TEXTURE2D_ARRAY(_NormalArray, sampler_NormalArray, uv, layer);
    float4 m = SAMPLE_TEXTURE2D_ARRAY(_MaskArray, sampler_AlbedoArray, uv, layer);

    LayerSample s;
    s.albedo = a.rgb * _VoxelLayerTint[layer].rgb;
    if (_VoxelLayerParams2[layer].z > 0.5) s.albedo *= VoxelBiomeTint(v.tint, v.temperature, v.humidity);
    s.alpha = a.a;
    s.normalTS = n.xyz * 2.0 - 1.0;
    s.normalTS.xy *= lp.y;
    s.normalTS = normalize(s.normalTS);
    s.ao = m.r;
    s.roughness = saturate(m.g * lp.z);
    s.metallic = m.b;
    s.emission = m.a * _VoxelLayerParams2[layer].x;
    return s;
}

// UV for a fragment: world-projected on cube faces (continuous across coplanar blocks), per-quad for plants.
float2 VoxelUV(float3 positionWS, VoxelVertex v, float2 cornerUV)
{
    if (v.face >= 6u) return cornerUV;
    float2 uvBlocks = float2(dot(positionWS, kFaceT[v.face]), dot(positionWS, kFaceB[v.face]));
    return uvBlocks * _VoxelLayerParams[v.layer].x;
}

// Alpha only (shadow/depth passes of cutout geometry).
float VoxelAlpha(float3 positionWS, VoxelVertex v, float2 cornerUV)
{
    float2 uv = VoxelUV(positionWS, v, cornerUV);
    return SAMPLE_TEXTURE2D_ARRAY(_AlbedoArray, sampler_AlbedoArray, uv, v.layer).a;
}

// Normal only (depth-normals prepass for SSAO): normal map + bevels, no albedo/mask/overlay work.
float3 EvaluateVoxelNormal(float3 positionWS, VoxelVertex v, float2 cornerUV)
{
    float3 N = kFaceN[v.face];
    float3 T = kFaceT[v.face];
    float3 B = kFaceB[v.face];
    float2 uv = VoxelUV(positionWS, v, cornerUV);
    float3 nTS = SAMPLE_TEXTURE2D_ARRAY(_NormalArray, sampler_NormalArray, uv, v.layer).xyz * 2.0 - 1.0;
    nTS.xy *= _VoxelLayerParams[v.layer].y;
    float3 normalWS = normalize(T * nTS.x + B * nTS.y + N * max(nTS.z, 1e-3));
    if (v.face < 6u && v.edges != 0u)
    {
        float3 local = positionWS - floor(positionWS - N * 0.5);
        float u = dot(local - 0.5, T) + 0.5;
        float w = dot(local - 0.5, B) + 0.5;
        float bw = _BevelWidth;
        float bevelFade = saturate(bw / max(max(fwidth(u), fwidth(w)), 1e-5) * 0.5 - 0.5);
        float3 tilt = 0;
        tilt -= (v.edges & 1u) ? T * saturate(1.0 - u / bw) : 0;
        tilt += (v.edges & 2u) ? T * saturate(1.0 - (1.0 - u) / bw) : 0;
        tilt -= (v.edges & 4u) ? B * saturate(1.0 - w / bw) : 0;
        tilt += (v.edges & 8u) ? B * saturate(1.0 - (1.0 - w) / bw) : 0;
        normalWS = normalize(normalWS + tilt * _BevelStrength * bevelFade * 1.3);
    }
    return normalWS;
}

// Full material evaluation: texture layers, grass/snow overhang on block sides, macro variation,
// bevelled convex block edges, voxel AO, biome tint, emission.
VoxelSurface EvaluateVoxelSurface(float3 positionWS, VoxelVertex v, float2 cornerUV)
{
    float3 N = kFaceN[v.face];
    float3 T = kFaceT[v.face];
    float3 B = kFaceB[v.face];
    bool plant = v.face >= 6u;

    float2 uvBlocks = float2(dot(positionWS, T), dot(positionWS, B));
    float2 uv = plant ? cornerUV : uvBlocks * _VoxelLayerParams[v.layer].x;

    // Block-local coordinates in [0,1] along T and B, used for bevels and side overlays.
    float3 cell = floor(positionWS - N * 0.5);
    float3 local = positionWS - cell;
    float u = dot(local - 0.5, T) + 0.5;
    float w = dot(local - 0.5, B) + 0.5;

    LayerSample s = SampleLayer(v.layer, uv, v);
    float alpha = _VoxelLayerParams2[v.layer].w > 0.5 ? s.alpha : 1.0;

    if (v.overlay != 255u)
    {
        // Grass (or snow) creeping over the top of dirt block sides with a ragged, height-driven edge.
        LayerSample o = SampleLayer(v.overlay, uvBlocks * _VoxelLayerParams[v.overlay].x, v);
        float jitter = VoxelHash21(cell.xz + cell.y * 17.0) - 0.5;
        float edge = 1.0 - _GrassOverhang + (o.alpha - 0.5) * 0.28 + jitter * 0.06;
        float m = smoothstep(edge - 0.035, edge + 0.035, w);
        float shadowBand = smoothstep(edge - 0.22, edge, w) * (1.0 - m);
        s.albedo = lerp(s.albedo * (1.0 - 0.3 * shadowBand), o.albedo, m);
        s.normalTS = normalize(lerp(s.normalTS, o.normalTS, m));
        s.ao = lerp(s.ao * (1.0 - 0.35 * shadowBand), o.ao, m);
        s.roughness = lerp(s.roughness, o.roughness, m);
        s.metallic = lerp(s.metallic, o.metallic, m);
    }

    float macroAmount = _VoxelLayerParams[v.layer].w;
    float2 mp = positionWS.xz + positionWS.y * float2(0.37, -0.21);
    float macro = VoxelValueNoise(mp * 0.035) * 0.65 + VoxelValueNoise(mp * 0.11 + 13.1) * 0.35;
    s.albedo *= lerp(1.0, 0.8 + 0.4 * macro, macroAmount);

    float3 normalWS = normalize(T * s.normalTS.x + B * s.normalTS.y + N * s.normalTS.z);

    float edgeAmt = 0;
    float bevelFade = 0;
    if (!plant)
    {
        float bw = _BevelWidth;
        float px = max(max(fwidth(u), fwidth(w)), 1e-5);
        bevelFade = saturate(bw / px * 0.5 - 0.5);
        float3 tilt = 0;
        float t;
        t = (v.edges & 1u) ? saturate(1.0 - u / bw) : 0.0;          tilt -= T * t; edgeAmt = max(edgeAmt, t);
        t = (v.edges & 2u) ? saturate(1.0 - (1.0 - u) / bw) : 0.0;  tilt += T * t; edgeAmt = max(edgeAmt, t);
        t = (v.edges & 4u) ? saturate(1.0 - w / bw) : 0.0;          tilt -= B * t; edgeAmt = max(edgeAmt, t);
        t = (v.edges & 8u) ? saturate(1.0 - (1.0 - w) / bw) : 0.0;  tilt += B * t; edgeAmt = max(edgeAmt, t);
        tilt *= _BevelStrength * bevelFade;
        normalWS = normalize(normalWS + tilt * 1.3);
    }

    float wear = edgeAmt * edgeAmt * _EdgeWear * bevelFade;
    s.albedo = lerp(s.albedo, s.albedo * 1.3 + 0.02, wear);
    s.roughness = lerp(s.roughness, saturate(s.roughness + 0.2), wear);

    float vao = lerp(0.28, 1.0, smoothstep(0.0, 1.0, v.ao));
    vao = lerp(1.0, vao, _VoxelAOStrength);

    VoxelSurface o;
    o.albedo = s.albedo;
    o.normalWS = normalWS;
    o.roughness = s.roughness;
    o.metallic = s.metallic;
    o.occlusion = s.ao * vao;
    o.directShade = lerp(1.0, vao, _VoxelAODirect);
    o.alpha = alpha;
    o.emission = s.albedo * s.emission;
    o.translucency = _VoxelLayerParams2[v.layer].y;
    o.specular = _VoxelLayerTint[v.layer].w;
    return o;
}

#endif
