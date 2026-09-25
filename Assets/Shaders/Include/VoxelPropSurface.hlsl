#ifndef VOXELWILD_PROP_SURFACE_INCLUDED
#define VOXELWILD_PROP_SURFACE_INCLUDED

// Voxelwild/Prop: Blender-made props (rocks, cave formations, dead wood, plants) drawn with GPU instancing.
//
// Materials sample the same block Texture2DArrays and per-layer tuning (TerrainLayerProfile globals) as the
// terrain, so a boulder reads as the same stone as the blocks around it. On top come the prop's own bakes
// (UV0): a tangent-space normal from the high-poly source, and a mask with AO (R), curvature (G, 0.5 = flat)
// and where moss may grow (B). Light comes from the voxel grid: PropField writes each instance's sky light,
// block light, temperature and humidity into _PropLight.
//
// Mapping (_Mapping): 0 = world-space triplanar (rock; continuous with terrain), 1 = UV1 in metres or
// 0..1 end grain (wood), 2 = vertex colour (plants, fungi). Vertex colour alpha is the wind weight; for
// foliage UV1.x is the biome-tint weight.

#include "Assets/Shaders/Include/VoxelCommon.hlsl"

TEXTURE2D_ARRAY(_AlbedoArray);  SAMPLER(sampler_AlbedoArray);
TEXTURE2D_ARRAY(_NormalArray);  SAMPLER(sampler_NormalArray);
TEXTURE2D_ARRAY(_MaskArray);
TEXTURE2D(_BakedNormal);        SAMPLER(sampler_BakedNormal);
TEXTURE2D(_BakedMask);          SAMPLER(sampler_BakedMask);

CBUFFER_START(UnityPerMaterial)
    float _Layer;
    float _MossLayer;
    float _Mapping;
    float _Tiling;
    float _Moss;
    float4 _Tint;
    float _Roughness;
    float _EdgeWear;
    float _Foliage;
    float _HasBakedNormal;
    float _HasBakedMask;
    float _Cull;
CBUFFER_END

// per-layer tuning shared with the terrain (see VoxelTerrainSurface.hlsl)
float4 _VoxelLayerParams[64];
float4 _VoxelLayerTint[64];
float4 _VoxelLayerParams2[64];

UNITY_INSTANCING_BUFFER_START(PropInstance)
    UNITY_DEFINE_INSTANCED_PROP(float4, _PropLight)     // sky, block, temperature, humidity (0..1)
UNITY_INSTANCING_BUFFER_END(PropInstance)

float4 PropLight()
{
    return UNITY_ACCESS_INSTANCED_PROP(PropInstance, _PropLight);
}

struct PropAttributes
{
    float4 positionOS : POSITION;
    float3 normalOS : NORMAL;
    float4 tangentOS : TANGENT;
    float4 color : COLOR;
    float2 uv0 : TEXCOORD0;
    float2 uv1 : TEXCOORD1;
    UNITY_VERTEX_INPUT_INSTANCE_ID
};

struct PropVaryings
{
    float4 positionCS : SV_POSITION;
    float3 positionWS : TEXCOORD0;
    float3 normalWS : TEXCOORD1;
    float4 tangentWS : TEXCOORD2;
    float4 color : TEXCOORD3;
    float4 uv : TEXCOORD4;          // xy bake UV, zw material UV
    float fog : TEXCOORD5;
    UNITY_VERTEX_INPUT_INSTANCE_ID
};

PropVaryings PropVertex(PropAttributes input)
{
    PropVaryings o = (PropVaryings)0;
    UNITY_SETUP_INSTANCE_ID(input);
    UNITY_TRANSFER_INSTANCE_ID(input, o);
    float3 positionWS = TransformObjectToWorld(input.positionOS.xyz);
    if (_Foliage > 0.5)
        positionWS += VoxelWindOffset(positionWS, input.color.a);
    o.positionWS = positionWS;
    o.positionCS = TransformWorldToHClip(positionWS);
    o.normalWS = TransformObjectToWorldNormal(input.normalOS);
    o.tangentWS = float4(TransformObjectToWorldDir(input.tangentOS.xyz), input.tangentOS.w * GetOddNegativeScale());
    o.color = input.color;
    o.uv = float4(input.uv0, input.uv1);
    return o;
}

struct PropSurface
{
    float3 albedo;
    float3 normalWS;
    float roughness;
    float metallic;
    float occlusion;
    float translucency;
    float specular;
};

float3 PropBakedNormal(PropVaryings i, float3 vertexNormal)
{
    if (_HasBakedNormal < 0.5) return vertexNormal;
    float3 nTS = UnpackNormal(SAMPLE_TEXTURE2D(_BakedNormal, sampler_BakedNormal, i.uv.xy));
    float3 bitangent = cross(vertexNormal, i.tangentWS.xyz) * i.tangentWS.w;
    return normalize(nTS.x * i.tangentWS.xyz + nTS.y * bitangent + nTS.z * vertexNormal);
}

// Triplanar sample of one layer around normal N; the detail normal is whiteout-blended onto N per axis.
void TriplanarLayer(uint layer, float3 p, float3 N, float scale,
                    out float3 albedo, out float3 normalWS, out float4 mask)
{
    float3 w = pow(abs(N), 4.0);
    w /= dot(w, 1.0);
    float2 uvX = p.zy * scale, uvY = p.xz * scale, uvZ = p.xy * scale;
    albedo = SAMPLE_TEXTURE2D_ARRAY(_AlbedoArray, sampler_AlbedoArray, uvX, layer).rgb * w.x
           + SAMPLE_TEXTURE2D_ARRAY(_AlbedoArray, sampler_AlbedoArray, uvY, layer).rgb * w.y
           + SAMPLE_TEXTURE2D_ARRAY(_AlbedoArray, sampler_AlbedoArray, uvZ, layer).rgb * w.z;
    mask = SAMPLE_TEXTURE2D_ARRAY(_MaskArray, sampler_AlbedoArray, uvX, layer) * w.x
         + SAMPLE_TEXTURE2D_ARRAY(_MaskArray, sampler_AlbedoArray, uvY, layer) * w.y
         + SAMPLE_TEXTURE2D_ARRAY(_MaskArray, sampler_AlbedoArray, uvZ, layer) * w.z;
    float strength = _VoxelLayerParams[layer].y;
    float3 nX = SAMPLE_TEXTURE2D_ARRAY(_NormalArray, sampler_NormalArray, uvX, layer).xyz * 2.0 - 1.0;
    float3 nY = SAMPLE_TEXTURE2D_ARRAY(_NormalArray, sampler_NormalArray, uvY, layer).xyz * 2.0 - 1.0;
    float3 nZ = SAMPLE_TEXTURE2D_ARRAY(_NormalArray, sampler_NormalArray, uvZ, layer).xyz * 2.0 - 1.0;
    nX.xy *= strength; nY.xy *= strength; nZ.xy *= strength;
    // whiteout blend in each projection's plane, swizzled back to world space
    nX = float3(nX.xy + N.zy, abs(nX.z) * N.x);
    nY = float3(nY.xy + N.xz, abs(nY.z) * N.y);
    nZ = float3(nZ.xy + N.xy, abs(nZ.z) * N.z);
    normalWS = normalize(nX.zyx * w.x + nY.xzy * w.y + nZ.xyz * w.z);
}

PropSurface EvaluatePropSurface(PropVaryings i, bool frontFace, float4 light)
{
    float3 vN = normalize(i.normalWS);
    if (_Foliage > 0.5 && !frontFace) vN = -vN;
    float3 N = PropBakedNormal(i, vN);
    float4 baked = _HasBakedMask > 0.5 ? SAMPLE_TEXTURE2D(_BakedMask, sampler_BakedMask, i.uv.xy) : float4(1, 0.5, 0, 1);

    PropSurface s;
    s.metallic = 0;
    s.translucency = 0;
    s.specular = 1;
    uint layer = (uint)_Layer;
    float layerAO = 1;

    if (_Mapping < 0.5)
    {
        float4 m;
        float3 albedo;
        TriplanarLayer(layer, i.positionWS, N, _Tiling, albedo, N, m);
        s.albedo = albedo * _VoxelLayerTint[layer].rgb;
        s.roughness = saturate(m.g * _VoxelLayerParams[layer].z);
        s.metallic = m.b;
        s.specular = _VoxelLayerTint[layer].w;
        layerAO = m.r;
    }
    else if (_Mapping < 1.5)
    {
        float2 uv = i.uv.zw * _Tiling;
        float4 a = SAMPLE_TEXTURE2D_ARRAY(_AlbedoArray, sampler_AlbedoArray, uv, layer);
        float4 m = SAMPLE_TEXTURE2D_ARRAY(_MaskArray, sampler_AlbedoArray, uv, layer);
        float3 nTS = SAMPLE_TEXTURE2D_ARRAY(_NormalArray, sampler_NormalArray, uv, layer).xyz * 2.0 - 1.0;
        nTS.xy *= _VoxelLayerParams[layer].y;
        float3 T = normalize(i.tangentWS.xyz - N * dot(N, i.tangentWS.xyz));
        float3 B = cross(N, T) * i.tangentWS.w;
        N = normalize(nTS.x * T + nTS.y * B + max(nTS.z, 1e-3) * N);
        s.albedo = a.rgb * _VoxelLayerTint[layer].rgb;
        s.roughness = saturate(m.g * _VoxelLayerParams[layer].z);
        s.specular = _VoxelLayerTint[layer].w;
        layerAO = m.r;
    }
    else
    {
        s.albedo = SRGBToLinear(i.color.rgb);
        s.roughness = 0.8;
        if (_Foliage > 0.5)
        {
            s.albedo *= lerp(1.0, VoxelBiomeTint(1u, light.z, light.w), i.uv.z);
            // thin blades: light them like a soft volume rather than a flat card
            N = normalize(N + float3(0, 0.8, 0));
            s.translucency = 0.6;
            s.specular = 0.3;
        }
    }
    s.albedo *= _Tint.rgb;
    s.roughness = saturate(s.roughness * _Roughness);

    // moss on up-facing, sheltered spots the bake marked, tinted by the local climate like grass
    if (_Moss > 0)
    {
        float up = saturate(N.y * 1.4 - 0.1);
        float moss = saturate(baked.b * _Moss * 2.5) * up;
        if (moss > 0.001)
        {
            uint ml = (uint)_MossLayer;
            float2 muv = i.positionWS.xz * 0.5;
            float3 ma = SAMPLE_TEXTURE2D_ARRAY(_AlbedoArray, sampler_AlbedoArray, muv, ml).rgb * _VoxelLayerTint[ml].rgb
                        * VoxelBiomeTint(1u, light.z, light.w);
            float h = SAMPLE_TEXTURE2D_ARRAY(_AlbedoArray, sampler_AlbedoArray, muv, ml).a;
            moss = smoothstep(0.35, 0.65, moss + (h - 0.5) * 0.5);
            s.albedo = lerp(s.albedo, ma, moss);
            s.roughness = lerp(s.roughness, 0.95, moss);
            s.specular = lerp(s.specular, 0.3, moss);
        }
    }

    // curvature: worn, lighter convex edges and darker crevices (the bake's G channel, 0.5 = flat)
    float convex = saturate((baked.g - 0.55) * 3.0);
    float concave = saturate((0.45 - baked.g) * 3.0);
    s.albedo *= 1.0 + convex * _EdgeWear - concave * 0.25;
    s.roughness = saturate(s.roughness + convex * 0.1);

    if (_Foliage < 0.5 && (_VoxelWeather.x + _VoxelWeather.y) > 0.001)
    {
        float3 snowAlbedo = 0;
        [branch] if (_VoxelWeather.y > 0.001)
        {
            uint snowLayer = (uint)_VoxelWeather.w;
            snowAlbedo = SAMPLE_TEXTURE2D_ARRAY(_AlbedoArray, sampler_AlbedoArray,
                i.positionWS.xz * _VoxelLayerParams[snowLayer].x, snowLayer).rgb * _VoxelLayerTint[snowLayer].rgb;
        }
        VoxelWeatherSurface(i.positionWS, smoothstep(0.55, 0.95, light.x), N.y > 0.8, snowAlbedo,
                            s.albedo, s.roughness, N, s.specular);
    }

    s.normalWS = N;
    s.occlusion = baked.r * layerAO;
    return s;
}

#endif
