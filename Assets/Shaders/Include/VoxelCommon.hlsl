#ifndef VOXELWILD_VOXEL_COMMON_INCLUDED
#define VOXELWILD_VOXEL_COMMON_INCLUDED

// Face tables, vertex decoding, biome tint, wind and noise shared by terrain, foliage and water.
// Face tables must match Voxelwild.World.Faces (C#). Faces 6/7 are the diagonal planes of plants.

#define VOXEL_SQRT_HALF 0.70710678

static const float3 kFaceN[8] = { float3(1,0,0), float3(-1,0,0), float3(0,1,0), float3(0,-1,0), float3(0,0,1), float3(0,0,-1),
                                  float3(VOXEL_SQRT_HALF,0,-VOXEL_SQRT_HALF), float3(VOXEL_SQRT_HALF,0,VOXEL_SQRT_HALF) };
static const float3 kFaceT[8] = { float3(0,0,1), float3(0,0,-1), float3(1,0,0), float3(-1,0,0), float3(-1,0,0), float3(1,0,0),
                                  float3(VOXEL_SQRT_HALF,0,VOXEL_SQRT_HALF), float3(-VOXEL_SQRT_HALF,0,VOXEL_SQRT_HALF) };
static const float3 kFaceB[8] = { float3(0,1,0), float3(0,1,0), float3(0,0,1), float3(0,0,1), float3(0,1,0), float3(0,1,0),
                                  float3(0,1,0), float3(0,1,0) };

// x,z = wind direction, y = strength, w = gustiness. Set by EnvironmentLighting (weather drives it later).
float4 _VoxelWind;

struct VoxelVertex
{
    uint face;
    uint edges;     // cubes: convex edge mask (bit0 -T, bit1 +T, bit2 -B, bit3 +B); plants: quad corner (bit0 u, bit1 v)
    uint layer;
    uint overlay;   // 255 = none
    float ao;       // 0 (fully occluded corner) .. 1
    float sky;      // 0..1 sky light
    float block;    // 0..1 block light
    float temperature;
    float humidity;
    uint tint;      // TintMode
    float wind;     // 0..1 sway weight
};

VoxelVertex DecodeVoxelVertex(float4 d0, float4 d1, float4 d2)
{
    uint4 a = (uint4)round(d0 * 255.0);
    uint4 c = (uint4)round(d2 * 255.0);
    VoxelVertex o;
    o.face = a.x & 7u;
    o.edges = (a.x >> 3) & 15u;
    o.layer = a.y;
    o.ao = a.z / 255.0;
    o.overlay = a.w;
    o.sky = d1.x;
    o.block = d1.y;
    o.temperature = d1.z;
    o.humidity = d1.w;
    o.tint = c.x;
    o.wind = d2.y;
    return o;
}

float VoxelHash21(float2 p)
{
    p = frac(p * float2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return frac(p.x * p.y);
}

float VoxelValueNoise(float2 p)
{
    float2 i = floor(p);
    float2 f = frac(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = VoxelHash21(i);
    float b = VoxelHash21(i + float2(1, 0));
    float c = VoxelHash21(i + float2(0, 1));
    float d = VoxelHash21(i + float2(1, 1));
    return lerp(lerp(a, b, f.x), lerp(c, d, f.x), f.y);
}

// Multiplier applied to tintable layers (grass, leaves). The scanned textures are already a temperate
// green, so the palette is relative: 1 = unchanged. Corners: cold/hot x dry/wet.
float3 VoxelBiomeTint(uint mode, float t, float h)
{
    if (mode == 0u) return 1.0;
    if (mode == 3u) return float3(1.18, 1.16, 0.78);     // birch: light yellow-green
    if (mode == 4u) return float3(0.86, 0.96, 0.92);     // spruce: cool blue-green
    float3 coldDry, coldWet, hotDry, hotWet;
    if (mode == 1u)   // grass
    {
        coldDry = float3(0.86, 0.94, 0.86); coldWet = float3(0.72, 0.9, 0.82);
        hotDry = float3(1.2, 1.03, 0.62);   hotWet = float3(0.78, 1.08, 0.66);
    }
    else              // foliage
    {
        coldDry = float3(0.9, 0.95, 0.85);  coldWet = float3(0.74, 0.88, 0.8);
        hotDry = float3(1.2, 1.05, 0.6);    hotWet = float3(0.72, 1.1, 0.6);
    }
    float3 c = lerp(lerp(coldDry, hotDry, t), lerp(coldWet, hotWet, t), h);
    float away = saturate(length(float2(t, h) - 0.5) * 2.2);
    float3 tint = lerp(1.0, c, away);
    // swamps (wet, mild) read murky olive
    float swamp = smoothstep(0.66, 0.8, h) * smoothstep(0.35, 0.45, t) * (1.0 - smoothstep(0.62, 0.7, t));
    return lerp(tint, float3(0.74, 0.8, 0.56), swamp * 0.8);
}

// Sway in world space; weight is 0 at plant roots and 1 at tips (leaves use a partial weight everywhere).
float3 VoxelWindOffset(float3 positionWS, float weight)
{
    if (weight <= 0.0) return 0;
    float t = _Time.y;
    float phase = dot(positionWS.xz, float2(0.37, 0.29));
    float gust = 0.6 + 0.4 * sin(t * 0.37 + positionWS.x * 0.02) * _VoxelWind.w;
    float sway = sin(t * 1.9 + phase) * 0.6 + sin(t * 3.3 + phase * 1.7) * 0.25;
    float3 dir = float3(_VoxelWind.x, 0.0, _VoxelWind.z);
    float s = _VoxelWind.y * weight * gust;
    return dir * (sway + 0.6) * s + float3(0, -abs(sway) * s * 0.15, 0);
}

#endif
