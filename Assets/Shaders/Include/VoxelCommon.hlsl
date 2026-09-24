#ifndef VOXELWILD_VOXEL_COMMON_INCLUDED
#define VOXELWILD_VOXEL_COMMON_INCLUDED

// Face tables, vertex decoding and noise shared by terrain and water.
// Face tables must match Voxelwild.World.Faces (C#).

static const float3 kFaceN[6] = { float3(1,0,0), float3(-1,0,0), float3(0,1,0), float3(0,-1,0), float3(0,0,1), float3(0,0,-1) };
static const float3 kFaceT[6] = { float3(0,0,1), float3(0,0,-1), float3(1,0,0), float3(-1,0,0), float3(-1,0,0), float3(1,0,0) };
static const float3 kFaceB[6] = { float3(0,1,0), float3(0,1,0),  float3(0,0,1), float3(0,0,1),  float3(0,1,0),  float3(0,1,0) };

struct VoxelVertexData
{
    uint face;
    uint edges;     // bit0 -T, bit1 +T, bit2 -B, bit3 +B : convex (exposed) block edges
    uint layer;
    uint overlay;   // 255 = none
    float ao;       // 0 (fully occluded corner) .. 1
};

VoxelVertexData DecodeVoxelVertex(float4 packed)
{
    uint4 d = (uint4)round(packed * 255.0);
    VoxelVertexData o;
    o.face = d.x & 7u;
    o.edges = (d.x >> 3) & 15u;
    o.layer = d.y;
    o.ao = d.z / 255.0;
    o.overlay = d.w;
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

#endif
