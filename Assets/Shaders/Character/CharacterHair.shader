// Hair cards and strand ribbons (eyelashes, eyebrows).
// Shading: Scheuermann/Kajiya-Kay with two shifted highlights along the strand direction (a white
// primary reflection R and a coloured, noisier secondary TRT), wrapped diffuse, and back-lit transmission.
// The strand direction is the mesh bitangent: cards and ribbons have U across and V root->tip.
// Card texture: R = root->tip, G = per-strand brightness, A = coverage (mips preserve alpha coverage).
// Ribbons (_RIBBON): no texture; coverage fades across the width and toward the tip from the UVs.
// Two passes: an alpha-tested core that writes depth (sorted, shadowed, SSAO), then a blended pass for the
// soft fringe that only draws where the core was clipped.
Shader "Voxelwild/Character/Hair"
{
    Properties
    {
        [MainTexture] _BaseMap ("Card Texture (R root-tip, G strand id, A coverage)", 2D) = "white" {}
        [Toggle(_RIBBON)] _Ribbon ("Ribbon (alpha from UV)", Float) = 0
        _HairColor ("Hair Colour", Color) = (0.44, 0.36, 0.28, 1)
        _RootDarken ("Root Darken", Range(0, 1)) = 0.35
        _TipLighten ("Tip Lighten", Range(0, 1)) = 0.2
        _StrandVariation ("Strand Variation", Range(0, 1)) = 0.35
        _Cutoff ("Alpha Cutoff (core)", Range(0.05, 0.95)) = 0.5
        _SpecShift1 ("Primary Shift", Range(-1, 1)) = -0.08
        _SpecShift2 ("Secondary Shift", Range(-1, 1)) = 0.12
        _SpecExp1 ("Primary Exponent", Range(4, 1024)) = 280
        _SpecExp2 ("Secondary Exponent", Range(4, 512)) = 60
        _SpecStrength1 ("Primary Strength", Range(0, 2)) = 0.18
        _SpecStrength2 ("Secondary Strength", Range(0, 2)) = 0.30
        _Transmission ("Back-lit Transmission", Range(0, 2)) = 0.5
        _AOStrength ("Root Occlusion", Range(0, 1)) = 0.55
        _VoxelSky ("Voxel Sky Light", Range(0, 1)) = 1
        _VoxelBlock ("Voxel Block Light", Range(0, 1)) = 0
    }

    SubShader
    {
        Tags { "RenderType" = "TransparentCutout" "RenderPipeline" = "UniversalPipeline" "Queue" = "AlphaTest+20" }
        Cull Off

        HLSLINCLUDE
        #pragma target 4.5
        #pragma shader_feature_local _RIBBON
        #define CHAR_ALPHA_CLIP 1
        #include "Assets/Shaders/Character/Include/CharacterCommon.hlsl"
        TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);
        CBUFFER_START(UnityPerMaterial)
            float4 _BaseMap_ST;
            half4 _HairColor;
            half _RootDarken, _TipLighten, _StrandVariation, _Cutoff;
            half _SpecShift1, _SpecShift2, _SpecExp1, _SpecExp2, _SpecStrength1, _SpecStrength2;
            half _Transmission, _AOStrength, _VoxelSky, _VoxelBlock, _Ribbon;
        CBUFFER_END

        half4 SampleCard(float2 uv)
        {
        #if defined(_RIBBON)
            half across = 1.0h - pow(abs(uv.x * 2.0h - 1.0h), 4.0h);
            half tip = 1.0h - smoothstep(0.65h, 1.0h, uv.y);
            return half4(uv.y, 0.75h, 0, across * tip);
        #else
            return SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, TRANSFORM_TEX(uv, _BaseMap));
        #endif
        }

        half CharAlpha(float2 uv) { return SampleCard(uv).a; }
        ENDHLSL

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForwardOnly" }
            ZWrite On

            HLSLPROGRAM
            #pragma vertex CharVert
            #pragma fragment HairCoreFrag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile _ _ADDITIONAL_LIGHTS
            #pragma multi_compile_fragment _ _ADDITIONAL_LIGHT_SHADOWS
            #pragma multi_compile_fragment _ _REFLECTION_PROBE_BLENDING
            #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
            #pragma multi_compile_fragment _ _SCREEN_SPACE_OCCLUSION
            #pragma multi_compile _ _LIGHT_LAYERS
            #pragma multi_compile _ _CLUSTER_LIGHT_LOOP
            #include_with_pragmas "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Fog.hlsl"
            #include "Assets/Shaders/Character/Include/CharacterHairLighting.hlsl"

            half4 HairCoreFrag(CharVaryings i, bool frontFace : SV_IsFrontFace) : SV_Target
            {
                half4 card = SampleCard(i.uv);
                clip(card.a - _Cutoff);
                return half4(ShadeHair(i, card, frontFace), 1);
            }
            ENDHLSL
        }

        Pass
        {
            Name "SoftFringe"
            Tags { "LightMode" = "SRPDefaultUnlit" }
            ZWrite Off
            ZTest Less
            Blend SrcAlpha OneMinusSrcAlpha

            HLSLPROGRAM
            #pragma vertex CharVert
            #pragma fragment HairFringeFrag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile _ _ADDITIONAL_LIGHTS
            #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
            #pragma multi_compile _ _CLUSTER_LIGHT_LOOP
            #include_with_pragmas "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Fog.hlsl"
            #include "Assets/Shaders/Character/Include/CharacterHairLighting.hlsl"

            half4 HairFringeFrag(CharVaryings i, bool frontFace : SV_IsFrontFace) : SV_Target
            {
                half4 card = SampleCard(i.uv);
                if (card.a >= _Cutoff || card.a < 0.03h) discard;
                return half4(ShadeHair(i, card, frontFace), saturate(card.a / _Cutoff));
            }
            ENDHLSL
        }

        Pass
        {
            Name "ShadowCaster"
            Tags { "LightMode" = "ShadowCaster" }
            ZWrite On ZTest LEqual ColorMask 0

            HLSLPROGRAM
            #pragma vertex ShadowVert
            #pragma fragment ShadowFrag
            #pragma multi_compile_vertex _ _CASTING_PUNCTUAL_LIGHT_SHADOW
            #include "Assets/Shaders/Character/Include/CharacterShadow.hlsl"
            ENDHLSL
        }

        Pass
        {
            Name "DepthOnly"
            Tags { "LightMode" = "DepthOnly" }
            ZWrite On ColorMask R

            HLSLPROGRAM
            #pragma vertex CharVert
            #pragma fragment DepthFrag
            half DepthFrag(CharVaryings i) : SV_Target { clip(CharAlpha(i.uv) - _Cutoff); return i.positionCS.z; }
            ENDHLSL
        }

        Pass
        {
            Name "DepthNormals"
            Tags { "LightMode" = "DepthNormals" }
            ZWrite On

            HLSLPROGRAM
            #pragma vertex CharVert
            #pragma fragment DepthNormalsFrag
            #pragma multi_compile_fragment _ _GBUFFER_NORMALS_OCT
            #include "Assets/Shaders/Character/Include/CharacterDepthNormals.hlsl"
            ENDHLSL
        }
    }

    FallBack Off
}
