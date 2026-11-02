// Cornea / tear film: a clear, wet shell. Only reflection is drawn (premultiplied): sharp GGX highlights
// from every light plus the reflection probe, weighted by Fresnel for water (IOR 1.376). Used for the
// corneal shell and the tear meniscus strip along the lid margin.
Shader "Voxelwild/Character/Cornea"
{
    Properties
    {
        _Roughness ("Roughness", Range(0.0, 0.5)) = 0.03
        _F0 ("F0", Range(0.0, 0.1)) = 0.025
        _Opacity ("Fresnel Tint Opacity", Range(0, 1)) = 0.15
        _EdgeFade ("Edge Fade (UV v)", Range(0, 0.5)) = 0.0
        _VoxelSky ("Voxel Sky Light", Range(0, 1)) = 1
        _VoxelBlock ("Voxel Block Light", Range(0, 1)) = 0
    }

    SubShader
    {
        Tags { "RenderType" = "Transparent" "RenderPipeline" = "UniversalPipeline" "Queue" = "Transparent-5" }

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }
            Blend One OneMinusSrcAlpha
            ZWrite Off

            HLSLPROGRAM
            #pragma target 4.5
            #pragma vertex CharVert
            #pragma fragment CorneaFrag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile _ _ADDITIONAL_LIGHTS
            #pragma multi_compile_fragment _ _REFLECTION_PROBE_BLENDING
            #pragma multi_compile_fragment _ _REFLECTION_PROBE_BOX_PROJECTION
            #pragma multi_compile_fragment _ _REFLECTION_PROBE_ATLAS
            #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
            #pragma multi_compile _ _CLUSTER_LIGHT_LOOP
            #include "Assets/Shaders/Character/Include/CharacterCommon.hlsl"

            CBUFFER_START(UnityPerMaterial)
                half _Roughness, _F0, _Opacity, _EdgeFade, _VoxelSky, _VoxelBlock;
            CBUFFER_END

            half3 SpecLight(Light light, half3 n, half3 V, half directScale)
            {
                half3 L = light.direction;
                half3 H = normalize(L + V);
                half NoL = saturate(dot(n, L));
                half NoV = max(dot(n, V), 1e-4h);
                half a = max(_Roughness * _Roughness, 0.0015h);
                half3 F = F_Schlick(_F0.xxx, saturate(dot(V, H)));
                half3 spec = D_GGX(saturate(dot(n, H)), a) * V_SmithGGXCorrelatedApprox(NoV, NoL, a) * F * NoL;
                return spec * light.color * light.distanceAttenuation * light.shadowAttenuation * directScale;
            }

            half4 CorneaFrag(CharVaryings i, bool frontFace : SV_IsFrontFace) : SV_Target
            {
                half3 n = normalize(i.normalWS);
                if (!frontFace) n = -n;
                InputData inputData = CharInputData(i, n);
                half3 V = inputData.viewDirectionWS;
                CharVoxelLight vox = GetCharVoxelLight(_VoxelSky, _VoxelBlock);
                half3 color = 0;
                Light mainLight = GetMainLight(inputData.shadowCoord, inputData.positionWS, inputData.shadowMask);
                color += SpecLight(mainLight, n, V, vox.direct);
                CHAR_ADDITIONAL_LIGHTS(color, SpecLight(light, n, V, 1.0h))
                half NoV = saturate(dot(n, V));
                half3 R = reflect(-V, n);
                half3 env = GlossyEnvironmentReflection(R, inputData.positionWS, sqrt(_Roughness), 1.0h, inputData.normalizedScreenSpaceUV);
                half fres = F_Schlick(_F0.xxx, NoV).x;
                color += env * fres * vox.ambient;
                half fade = _EdgeFade > 0 ? smoothstep(0.0h, _EdgeFade, min(i.uv.y, 1.0h - i.uv.y)) : 1.0h;
                return half4(color * fade, fres * _Opacity * fade);
            }
            ENDHLSL
        }
    }

    FallBack Off
}
