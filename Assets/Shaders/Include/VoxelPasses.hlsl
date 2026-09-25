#ifndef VOXELWILD_PASSES_INCLUDED
#define VOXELWILD_PASSES_INCLUDED

// Vertex/fragment programs shared by Voxelwild/Terrain (opaque) and Voxelwild/Foliage (VOXEL_CUTOUT:
// alpha-tested, double-sided, wind). Include after Core.hlsl and VoxelTerrainSurface.hlsl.

struct VoxelAttributes
{
    float4 positionOS : POSITION;
    float4 d0 : TEXCOORD0;
    float4 d1 : TEXCOORD1;
    float4 d2 : TEXCOORD2;
};

struct VoxelVaryings
{
    float4 positionCS : SV_POSITION;
    float3 positionWS : TEXCOORD0;
    nointerpolation float4 faceData : TEXCOORD1;   // face, edges, layer, overlay
    float4 light : TEXCOORD2;                      // ao, sky, block, fog
    nointerpolation float4 climate : TEXCOORD3;    // temperature, humidity, tint, unused
    float2 cornerUV : TEXCOORD4;
};

VoxelVertex VaryingsToVertex(VoxelVaryings i)
{
    VoxelVertex v;
    v.face = (uint)i.faceData.x;
    v.edges = (uint)i.faceData.y;
    v.layer = (uint)i.faceData.z;
    v.overlay = (uint)i.faceData.w;
    v.ao = i.light.x;
    v.sky = i.light.y;
    v.block = i.light.z;
    v.temperature = i.climate.x;
    v.humidity = i.climate.y;
    v.tint = (uint)i.climate.z;
    v.wind = 0;
    return v;
}

VoxelVaryings VoxelVertexProgram(VoxelAttributes input, out VoxelVertex v)
{
    v = DecodeVoxelVertex(input.d0, input.d1, input.d2);
    VoxelVaryings o;
    float3 positionWS = TransformObjectToWorld(input.positionOS.xyz);
#if defined(VOXEL_CUTOUT)
    positionWS += VoxelWindOffset(positionWS, v.wind);
#endif
    o.positionWS = positionWS;
    o.positionCS = TransformWorldToHClip(positionWS);
    o.faceData = float4(v.face, v.edges, v.layer, v.overlay);
    o.light = float4(v.ao, v.sky, v.block, 0);
    o.climate = float4(v.temperature, v.humidity, v.tint, 0);
    o.cornerUV = float2(v.edges & 1u, (v.edges >> 1) & 1u);
    return o;
}

// ---------------------------------------------------------------- forward lit

VoxelVaryings VoxelForwardVert(VoxelAttributes input)
{
    VoxelVertex v;
    VoxelVaryings o = VoxelVertexProgram(input, v);
    o.light.w = ComputeFogFactor(o.positionCS.z);
    return o;
}

half4 VoxelForwardFrag(VoxelVaryings i, bool frontFace : SV_IsFrontFace) : SV_Target
{
    VoxelVertex v = VaryingsToVertex(i);
    VoxelSurface s = EvaluateVoxelSurface(i.positionWS, v, i.cornerUV);
#if defined(VOXEL_CUTOUT)
    clip(s.alpha - _Cutoff);
    if (!frontFace) s.normalWS = -s.normalWS;
#endif

    InputData inputData = (InputData)0;
    inputData.positionWS = i.positionWS;
    inputData.positionCS = i.positionCS;
    inputData.normalWS = s.normalWS;
    inputData.viewDirectionWS = GetWorldSpaceNormalizeViewDir(i.positionWS);
    inputData.shadowCoord = TransformWorldToShadowCoord(i.positionWS);
    inputData.fogCoord = InitializeInputDataFog(float4(i.positionWS, 1.0), i.light.w);
    inputData.normalizedScreenSpaceUV = GetNormalizedScreenSpaceUV(i.positionCS);
    inputData.bakedGI = SampleSHPixel(half3(0, 0, 0), s.normalWS);
    inputData.shadowMask = half4(1, 1, 1, 1);

    SurfaceData surface = (SurfaceData)0;
    surface.albedo = s.albedo * s.directShade;
    surface.metallic = s.metallic;
    surface.specular = half3(0, 0, 0);
    surface.smoothness = 1.0 - s.roughness;
    surface.normalTS = half3(0, 0, 1);
    surface.occlusion = s.occlusion * VoxelSkyAmbient(v.sky);
    surface.emission = s.emission;
    surface.alpha = 1.0;

    half skyDirect = VoxelSkyDirect(v.sky);
    half3 blockIrr = VoxelBlockIrradiance(v.block) * s.occlusion;

    half3 transAlbedo = 0;
#if defined(VOXEL_CUTOUT)
    // light passing through thin leaves and blades when the sun is behind them
    transAlbedo = s.albedo * s.translucency * _Translucency;
#endif

    half4 color = VoxelFragmentPBR(inputData, surface, skyDirect, blockIrr, transAlbedo, s.specular);
    color.rgb = VoxelApplyFog(color.rgb, i.positionWS, inputData.fogCoord);
    color.a = 1.0;
    return color;
}

// ---------------------------------------------------------------- shadow caster

float3 _LightDirection;
float3 _LightPosition;

struct VoxelShadowVaryings
{
    float4 positionCS : SV_POSITION;
#if defined(VOXEL_CUTOUT)
    float3 positionWS : TEXCOORD0;
    nointerpolation float4 faceData : TEXCOORD1;
    float2 cornerUV : TEXCOORD2;
#endif
};

VoxelShadowVaryings VoxelShadowVert(VoxelAttributes input)
{
    VoxelVertex v;
    VoxelVaryings b = VoxelVertexProgram(input, v);
    float3 normalWS = kFaceN[v.face];
#if _CASTING_PUNCTUAL_LIGHT_SHADOW
    float3 lightDirectionWS = normalize(_LightPosition - b.positionWS);
#else
    float3 lightDirectionWS = _LightDirection;
#endif
    VoxelShadowVaryings o;
    o.positionCS = ApplyShadowClamping(TransformWorldToHClip(ApplyShadowBias(b.positionWS, normalWS, lightDirectionWS)));
#if defined(VOXEL_CUTOUT)
    // small plants only cast shadows near the camera, leaves out to the mid cascades; beyond that sky-light
    // shading under the canopy carries the look and the far cascades stay cheap
    float shadowReach = v.face >= 6u ? 24.0 : 64.0;
    if (distance(b.positionWS, _WorldSpaceCameraPos) > shadowReach) o.positionCS = float4(0, 0, -2, 1);
#endif
#if defined(VOXEL_CUTOUT)
    o.positionWS = b.positionWS;
    o.faceData = b.faceData;
    o.cornerUV = b.cornerUV;
#endif
    return o;
}

half4 VoxelShadowFrag(VoxelShadowVaryings i) : SV_Target
{
#if defined(VOXEL_CUTOUT)
    VoxelVertex v = (VoxelVertex)0;
    v.face = (uint)i.faceData.x;
    v.layer = (uint)i.faceData.z;
    clip(VoxelAlpha(i.positionWS, v, i.cornerUV) - _Cutoff);
#endif
    return 0;
}

// ---------------------------------------------------------------- depth only

VoxelVaryings VoxelDepthVert(VoxelAttributes input)
{
    VoxelVertex v;
    return VoxelVertexProgram(input, v);
}

half VoxelDepthFrag(VoxelVaryings i) : SV_Target
{
#if defined(VOXEL_CUTOUT)
    clip(VoxelAlpha(i.positionWS, VaryingsToVertex(i), i.cornerUV) - _Cutoff);
#endif
    return i.positionCS.z;
}

// ---------------------------------------------------------------- depth normals (SSAO)

half4 VoxelDepthNormalsFrag(VoxelVaryings i, bool frontFace : SV_IsFrontFace) : SV_Target
{
    VoxelVertex v = VaryingsToVertex(i);
#if defined(VOXEL_CUTOUT)
    clip(VoxelAlpha(i.positionWS, v, i.cornerUV) - _Cutoff);
#endif
    float3 normalWS = EvaluateVoxelNormal(i.positionWS, v, i.cornerUV);
#if defined(VOXEL_CUTOUT)
    if (!frontFace) normalWS = -normalWS;
#endif
#if defined(_GBUFFER_NORMALS_OCT)
    float2 octNormalWS = PackNormalOctQuadEncode(normalWS);
    float2 remapped = saturate(octNormalWS * 0.5 + 0.5);
    return half4(PackFloat2To888(remapped), 0.0);
#else
    return half4(NormalizeNormalPerPixel(normalWS), 0.0);
#endif
}

#endif
