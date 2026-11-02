#ifndef VOXELWILD_CHARACTER_SHADOW_INCLUDED
#define VOXELWILD_CHARACTER_SHADOW_INCLUDED

// Shadow caster for character shaders. Define CHAR_ALPHA_CLIP and provide `half CharAlpha(float2 uv)` and
// `_Cutoff` before including to alpha-test (hair cards, lashes).
float3 _LightDirection;
float3 _LightPosition;

struct CharShadowVaryings
{
    float4 positionCS : SV_POSITION;
    float2 uv : TEXCOORD0;
};

CharShadowVaryings ShadowVert(CharAttributes input)
{
    CharShadowVaryings o;
    float3 positionWS = TransformObjectToWorld(input.positionOS.xyz);
    float3 normalWS = TransformObjectToWorldNormal(input.normalOS);
#if _CASTING_PUNCTUAL_LIGHT_SHADOW
    float3 lightDirectionWS = normalize(_LightPosition - positionWS);
#else
    float3 lightDirectionWS = _LightDirection;
#endif
    o.positionCS = ApplyShadowClamping(TransformWorldToHClip(ApplyShadowBias(positionWS, normalWS, lightDirectionWS)));
    o.uv = input.uv;
    return o;
}

half4 ShadowFrag(CharShadowVaryings i) : SV_Target
{
#if defined(CHAR_ALPHA_CLIP)
    clip(CharAlpha(i.uv) - _Cutoff);
#endif
    return 0;
}

#endif
