#ifndef VOXELWILD_CHARACTER_COMMON_INCLUDED
#define VOXELWILD_CHARACTER_COMMON_INCLUDED

// Shared code for the Voxelwild/Character/* shaders (skin, eye, cornea, eye occlusion, hair).
// Characters live in the voxel world, so they take the same voxel light terms as terrain:
//   _VoxelSky    0..1 sky exposure at the character (scales ambient, reflections and the sun)
//   _VoxelBlock  0..1 block light (torches) at the character
// Both are set per renderer by HumanCharacter (MaterialPropertyBlock), defaulting to open sky.
#include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
#include "Assets/Shaders/Include/VoxelLighting.hlsl"

struct CharAttributes
{
    float4 positionOS : POSITION;
    float3 normalOS : NORMAL;
    float4 tangentOS : TANGENT;
    float2 uv : TEXCOORD0;
};

struct CharVaryings
{
    float4 positionCS : SV_POSITION;
    float2 uv : TEXCOORD0;
    float3 positionWS : TEXCOORD1;
    float3 normalWS : TEXCOORD2;
    float4 tangentWS : TEXCOORD3;     // xyz tangent, w sign
    float3 positionOS : TEXCOORD4;
    float fogFactor : TEXCOORD5;
};

CharVaryings CharVert(CharAttributes input)
{
    CharVaryings o;
    VertexPositionInputs pos = GetVertexPositionInputs(input.positionOS.xyz);
    VertexNormalInputs nrm = GetVertexNormalInputs(input.normalOS, input.tangentOS);
    o.positionCS = pos.positionCS;
    o.positionWS = pos.positionWS;
    o.normalWS = nrm.normalWS;
    o.tangentWS = float4(nrm.tangentWS, input.tangentOS.w * GetOddNegativeScale());
    o.uv = input.uv;
    o.positionOS = input.positionOS.xyz;
    o.fogFactor = ComputeFogFactor(pos.positionCS.z);
    return o;
}

half3 CharTangentToWorld(half3 nTS, CharVaryings i, half3 normalWS)
{
    half3 t = normalize(i.tangentWS.xyz);
    half3 b = cross(normalWS, t) * i.tangentWS.w;
    return normalize(nTS.x * t + nTS.y * b + nTS.z * normalWS);
}

// ------------------------------------------------------------------------------------------ BRDF
half D_GGX(half NoH, half a)
{
    half a2 = a * a;
    half d = (NoH * a2 - NoH) * NoH + 1.0h;
    return a2 / max(PI * d * d, 1e-5h);
}

half V_SmithGGXCorrelatedApprox(half NoV, half NoL, half a)
{
    half v = NoL * (NoV * (1.0h - a) + a);
    half l = NoV * (NoL * (1.0h - a) + a);
    return 0.5h / max(v + l, 1e-5h);
}

half3 F_Schlick(half3 f0, half VoH)
{
    half f = pow(1.0h - VoH, 5.0h);
    return f0 + (1.0h - f0) * f;
}

// Karis' analytic environment BRDF approximation
half3 EnvBRDFApprox(half3 f0, half roughness, half NoV)
{
    const half4 c0 = half4(-1, -0.0275, -0.572, 0.022);
    const half4 c1 = half4(1, 0.0425, 1.04, -0.04);
    half4 r = roughness * c0 + c1;
    half a004 = min(r.x * r.x, exp2(-9.28h * NoV)) * r.x + r.y;
    half2 ab = half2(-1.04h, 1.04h) * a004 + r.zw;
    return f0 * ab.x + ab.y;
}

// ---------------------------------------------------------------------------------- voxel light
struct CharVoxelLight
{
    half ambient;    // multiplies SH and reflections
    half direct;     // multiplies the main light
    half3 block;     // added diffuse irradiance
};

CharVoxelLight GetCharVoxelLight(half sky, half block)
{
    CharVoxelLight v;
    v.ambient = VoxelSkyAmbient(sky);
    v.direct = VoxelSkyDirect(sky);
    v.block = VoxelBlockIrradiance(block);
    return v;
}

InputData CharInputData(CharVaryings i, half3 normalWS)
{
    InputData d = (InputData)0;
    d.positionWS = i.positionWS;
    d.positionCS = i.positionCS;
    d.normalWS = normalWS;
    d.viewDirectionWS = GetWorldSpaceNormalizeViewDir(i.positionWS);
    d.shadowCoord = TransformWorldToShadowCoord(i.positionWS);
    d.fogCoord = i.fogFactor;
    d.normalizedScreenSpaceUV = GetNormalizedScreenSpaceUV(i.positionCS);
    d.shadowMask = half4(1, 1, 1, 1);
    return d;
}

half CharScreenSpaceAO(float2 screenUV)
{
#if defined(_SCREEN_SPACE_OCCLUSION)
    return SampleAmbientOcclusion(screenUV);
#else
    return 1.0h;
#endif
}

// Light loop helper: calls CHAR_LIGHT(light) for the main light and every additional light.
// Usage: define a function `half3 ShadeLight(Light light, <surface>)` and expand CHAR_LIGHT_LOOP.
#if defined(_ADDITIONAL_LIGHTS)
    #if USE_CLUSTER_LIGHT_LOOP
        #define CHAR_DIRECTIONAL_LOOP(ACC, CALL) \
            [loop] for (uint lightIndex = 0; lightIndex < min(URP_FP_DIRECTIONAL_LIGHTS_COUNT, MAX_VISIBLE_LIGHTS); lightIndex++) \
            { CLUSTER_LIGHT_LOOP_SUBTRACTIVE_LIGHT_CHECK Light light = GetAdditionalLight(lightIndex, inputData.positionWS, inputData.shadowMask); ACC += CALL; }
    #else
        #define CHAR_DIRECTIONAL_LOOP(ACC, CALL)
    #endif
    #define CHAR_ADDITIONAL_LIGHTS(ACC, CALL) \
        { uint pixelLightCount = GetAdditionalLightsCount(); \
          CHAR_DIRECTIONAL_LOOP(ACC, CALL) \
          LIGHT_LOOP_BEGIN(pixelLightCount) \
              Light light = GetAdditionalLight(lightIndex, inputData.positionWS, inputData.shadowMask); \
              ACC += CALL; \
          LIGHT_LOOP_END }
#else
    #define CHAR_ADDITIONAL_LIGHTS(ACC, CALL)
#endif

#endif
