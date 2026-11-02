// Fabric for character clothing (shirt, jeans, shoes), matched to the Cycles look-dev cloth material:
//  - wrapped diffuse (fibres scatter light past the terminator);
//  - low, rough GGX specular (dielectric fibres, F0 0.04);
//  - Charlie sheen lobe (Estevez & Kulla) for the velvety grazing glow of cotton and denim fuzz;
//  - baked fold AO + wrinkle normal, plus a tiling weave normal (knit / twill) for close-ups.
// Mask map: R AO, G roughness, B unused, A sheen weight.
Shader "Voxelwild/Character/Cloth"
{
    Properties
    {
        [MainTexture] _BaseMap ("Base Color", 2D) = "white" {}
        [Normal][NoScaleOffset] _NormalMap ("Normal (OpenGL)", 2D) = "bump" {}
        [NoScaleOffset] _MaskMap ("AO (R) Roughness (G) - (B) Sheen (A)", 2D) = "white" {}
        _NormalStrength ("Normal Strength", Range(0, 2)) = 1
        [Normal][NoScaleOffset] _DetailNormalMap ("Weave Detail Normal", 2D) = "bump" {}
        _DetailTiling ("Weave Tiling", Float) = 8
        _DetailStrength ("Weave Strength", Range(0, 1)) = 0.6
        _Roughness ("Roughness (no mask)", Range(0, 1)) = 0.8
        _Sheen ("Sheen", Range(0, 2)) = 0.6
        _SheenRoughness ("Sheen Roughness", Range(0.05, 1)) = 0.4
        _Wrap ("Diffuse Wrap", Range(0, 1)) = 0.3
        _VoxelSky ("Voxel Sky Light", Range(0, 1)) = 1
        _VoxelBlock ("Voxel Block Light", Range(0, 1)) = 0
    }

    SubShader
    {
        Tags { "RenderType" = "Opaque" "RenderPipeline" = "UniversalPipeline" "Queue" = "Geometry" "UniversalMaterialType" = "Lit" }

        HLSLINCLUDE
        #pragma target 4.5
        #include "Assets/Shaders/Character/Include/CharacterCommon.hlsl"

        TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);
        TEXTURE2D(_NormalMap); SAMPLER(sampler_NormalMap);
        TEXTURE2D(_MaskMap); SAMPLER(sampler_MaskMap);
        TEXTURE2D(_DetailNormalMap); SAMPLER(sampler_DetailNormalMap);

        CBUFFER_START(UnityPerMaterial)
            float4 _BaseMap_ST;
            half _NormalStrength, _DetailTiling, _DetailStrength, _Roughness, _Sheen, _SheenRoughness, _Wrap;
            half _VoxelSky, _VoxelBlock;
        CBUFFER_END
        ENDHLSL

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }

            HLSLPROGRAM
            #pragma vertex CharVert
            #pragma fragment ClothFrag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile _ _ADDITIONAL_LIGHTS
            #pragma multi_compile_fragment _ _ADDITIONAL_LIGHT_SHADOWS
            #pragma multi_compile_fragment _ _REFLECTION_PROBE_BLENDING
            #pragma multi_compile_fragment _ _REFLECTION_PROBE_BOX_PROJECTION
            #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
            #pragma multi_compile_fragment _ _SCREEN_SPACE_OCCLUSION
            #pragma multi_compile _ _LIGHT_LAYERS
            #pragma multi_compile _ _CLUSTER_LIGHT_LOOP
            #include_with_pragmas "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Fog.hlsl"

            struct ClothSurface
            {
                half3 albedo;
                half3 n;
                half roughness;
                half sheen;
            };

            // Charlie sheen distribution and Neubelt's visibility term
            half D_Charlie(half NoH, half r)
            {
                half inv = 1.0h / max(r, 0.05h);
                half sin2 = max(1.0h - NoH * NoH, 0.0078125h);
                return (2.0h + inv) * pow(sin2, inv * 0.5h) / (2.0h * PI);
            }

            half V_Neubelt(half NoV, half NoL)
            {
                return saturate(1.0h / (4.0h * (NoL + NoV - NoL * NoV)));
            }

            half3 ClothLight(Light light, ClothSurface s, half3 V, half directScale)
            {
                half3 L = light.direction;
                half NoLr = dot(s.n, L);
                half NoL = saturate(NoLr);
                half NoV = max(dot(s.n, V), 1e-4h);
                half3 H = normalize(L + V);
                half NoH = saturate(dot(s.n, H));
                half shadow = light.shadowAttenuation * directScale;
                half diff = saturate((NoLr + _Wrap) / (1.0h + _Wrap)) / (1.0h + _Wrap * 0.5h);
                half a = max(s.roughness * s.roughness, 0.002h);
                half3 spec = D_GGX(NoH, a) * V_SmithGGXCorrelatedApprox(NoV, NoL, a) * F_Schlick(0.04h.xxx, saturate(dot(V, H))) * NoL;
                half sheen = D_Charlie(NoH, _SheenRoughness) * V_Neubelt(NoV, NoL) * NoL * s.sheen * _Sheen;
                half3 c = s.albedo * diff + spec + sheen * lerp(s.albedo, 1.0h.xxx, 0.3h);
                return c * light.color * light.distanceAttenuation * shadow;
            }

            half4 ClothFrag(CharVaryings i) : SV_Target
            {
                float2 uv = TRANSFORM_TEX(i.uv, _BaseMap);
                half3 albedo = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, uv).rgb;
                half4 mask = SAMPLE_TEXTURE2D(_MaskMap, sampler_MaskMap, uv);
                half3 nTS = UnpackNormalScale(SAMPLE_TEXTURE2D(_NormalMap, sampler_NormalMap, uv), _NormalStrength);
                half3 dTS = UnpackNormalScale(SAMPLE_TEXTURE2D(_DetailNormalMap, sampler_DetailNormalMap, uv * _DetailTiling), _DetailStrength);
                nTS = normalize(half3(nTS.xy + dTS.xy, nTS.z * dTS.z));
                half3 geomN = normalize(i.normalWS);

                ClothSurface s;
                s.n = CharTangentToWorld(nTS, i, geomN);
                s.albedo = albedo * lerp(1.0h, mask.r, 0.6h);
                s.roughness = mask.g < 0.999h ? mask.g : _Roughness;
                s.sheen = mask.a;

                InputData inputData = CharInputData(i, s.n);
                half3 V = inputData.viewDirectionWS;
                CharVoxelLight vox = GetCharVoxelLight(_VoxelSky, _VoxelBlock);
                half occl = mask.r * CharScreenSpaceAO(inputData.normalizedScreenSpaceUV);

                half3 color = 0;
                Light mainLight = GetMainLight(inputData.shadowCoord, inputData.positionWS, inputData.shadowMask);
                color += ClothLight(mainLight, s, V, vox.direct);
                CHAR_ADDITIONAL_LIGHTS(color, ClothLight(light, s, V, 1.0h))
                color += s.albedo * (SampleSH(s.n) * vox.ambient + vox.block) * occl;
                half NoV = saturate(dot(s.n, V));
                half3 env = GlossyEnvironmentReflection(reflect(-V, s.n), inputData.positionWS, sqrt(s.roughness), occl,
                                                        inputData.normalizedScreenSpaceUV);
                color += env * EnvBRDFApprox(0.04h.xxx, s.roughness, NoV) * vox.ambient;
                color = MixFog(color, inputData.fogCoord);
                return half4(color, 1);
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
            half DepthFrag(CharVaryings i) : SV_Target { return i.positionCS.z; }
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
