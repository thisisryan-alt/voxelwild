// Real-time skin for Voxelwild characters, matched to the Cycles look-dev (random-walk SSS) by:
//  - pre-integrated scattering: per-channel wrapped diffuse whose width follows screen-space curvature
//    (red scatters furthest), so terminators turn warm and soft on noses, ears and lips;
//  - per-channel normal blur for diffuse (red uses a blurred mip of the normal map, blue the full detail);
//  - dual-lobe GGX specular (sharp oily lobe + broad lobe), cavity specular occlusion, F0 of skin (IOR 1.4);
//  - back-lit transmission through thin parts (ears, nostrils) from the baked translucency mask;
//  - a tiling micro-detail normal for close-ups; vellus "peach fuzz" sheen at grazing angles.
// Mask map: R AO, G roughness, B cavity, A translucency.
Shader "Voxelwild/Character/Skin"
{
    Properties
    {
        [MainTexture] _BaseMap ("Base Color", 2D) = "white" {}
        [Normal][NoScaleOffset] _NormalMap ("Normal (OpenGL)", 2D) = "bump" {}
        [NoScaleOffset] _MaskMap ("AO (R) Roughness (G) Cavity (B) Translucency (A)", 2D) = "white" {}
        _NormalStrength ("Normal Strength", Range(0, 2)) = 1
        [Normal][NoScaleOffset] _DetailNormalMap ("Micro Detail Normal", 2D) = "bump" {}
        _DetailTiling ("Detail Tiling", Float) = 30
        _DetailStrength ("Detail Strength", Range(0, 1)) = 0.5
        _RoughnessScale ("Roughness Scale", Range(0.2, 2)) = 1
        _SpecularLevel ("Specular Level (1 = skin F0 0.028)", Range(0, 2)) = 1
        _LobeMix ("Sharp/Broad Lobe Mix", Range(0, 1)) = 0.65
        _ScatterColor ("Scatter Colour", Color) = (0.95, 0.38, 0.22, 1)
        _ScatterWidth ("Scatter Width", Range(0, 2)) = 0.9
        _CurvatureScale ("Curvature Scale", Range(0, 0.2)) = 0.03
        _NormalBlurMip ("Diffuse Normal Blur (mips)", Range(0, 6)) = 3.5
        _TransmissionColor ("Transmission Colour", Color) = (1.0, 0.25, 0.12, 1)
        _Translucency ("Translucency", Range(0, 3)) = 1
        _Sheen ("Vellus Sheen", Range(0, 1)) = 0.15
        _CavityAlbedo ("Cavity Darkening", Range(0, 1)) = 0.6
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
            half _NormalStrength, _DetailTiling, _DetailStrength, _RoughnessScale, _SpecularLevel, _LobeMix;
            half4 _ScatterColor;
            half _ScatterWidth, _CurvatureScale, _NormalBlurMip;
            half4 _TransmissionColor;
            half _Translucency, _Sheen, _CavityAlbedo, _VoxelSky, _VoxelBlock;
        CBUFFER_END
        ENDHLSL

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }

            HLSLPROGRAM
            #pragma vertex CharVert
            #pragma fragment SkinFrag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile _ _ADDITIONAL_LIGHTS
            #pragma multi_compile_fragment _ _ADDITIONAL_LIGHT_SHADOWS
            #pragma multi_compile_fragment _ _REFLECTION_PROBE_BLENDING
            #pragma multi_compile_fragment _ _REFLECTION_PROBE_BOX_PROJECTION
            #pragma multi_compile_fragment _ _REFLECTION_PROBE_ATLAS
            #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
            #pragma multi_compile_fragment _ _SCREEN_SPACE_OCCLUSION
            #pragma multi_compile_fragment _ _LIGHT_COOKIES
            #pragma multi_compile _ _LIGHT_LAYERS
            #pragma multi_compile _ _CLUSTER_LIGHT_LOOP
            #include_with_pragmas "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Fog.hlsl"

            struct SkinSurface
            {
                half3 albedo;
                half3 n;          // full-detail shading normal
                half3 nBlur;      // blurred normal (deep scattering)
                half roughness;
                half cavity;
                half ao;
                half translucency;
                half curvature;
                half3 f0;
            };

            half3 SkinLight(Light light, SkinSurface s, half3 V, half directScale)
            {
                half3 L = light.direction;
                half shadow = light.shadowAttenuation * directScale;
                half3 radiance = light.color * light.distanceAttenuation;

                // diffuse: per-channel normals and curvature-wrapped falloff (pre-integrated scattering fit)
                half3 nR = normalize(lerp(s.n, s.nBlur, 0.85h));
                half3 nG = normalize(lerp(s.n, s.nBlur, 0.45h));
                half3 nB = normalize(lerp(s.n, s.nBlur, 0.20h));
                half3 NoL3 = half3(dot(nR, L), dot(nG, L), dot(nB, L));
                half3 w = _ScatterColor.rgb * (_ScatterWidth * saturate(s.curvature));
                half3 diff = saturate((NoL3 + w) / (1.0h + w));
                diff *= diff * (1.0h + w) / (1.0h + w * 0.5h);          // keep the lit side energy close to Lambert
                // shadow edges scatter too: soften the penumbra in red
                half softShadow = sqrt(max(shadow, 0.0h));
                half3 sh = lerp((half3)shadow, (half3)softShadow, _ScatterColor.rgb * 0.6h);
                half3 diffuse = s.albedo * diff * sh;

                // specular: two GGX lobes
                half3 H = normalize(L + V);
                half NoL = saturate(dot(s.n, L));
                half NoV = max(dot(s.n, V), 1e-4h);
                half NoH = saturate(dot(s.n, H));
                half VoH = saturate(dot(V, H));
                half a0 = max(s.roughness * s.roughness * 0.55h, 0.002h);
                half a1 = max(s.roughness * s.roughness * 1.6h, 0.002h);
                half D = lerp(D_GGX(NoH, a1), D_GGX(NoH, a0), _LobeMix);
                half Vis = V_SmithGGXCorrelatedApprox(NoV, NoL, lerp(a1, a0, _LobeMix));
                half3 F = F_Schlick(s.f0, VoH);
                half3 spec = D * Vis * F * NoL * shadow * s.cavity;

                // transmission through thin tissue when lit from behind
                half back = saturate(dot(-s.nBlur, L) * 0.6h + 0.4h);
                half3 trans = _TransmissionColor.rgb * s.albedo * (s.translucency * _Translucency) * back * back
                            * lerp(1.0h, shadow, 0.35h);

                // vellus sheen: soft grazing glow on the lit side
                half fuzz = pow(1.0h - NoV, 4.0h) * saturate(NoL3.g + 0.2h) * _Sheen;

                return radiance * (diffuse + spec + trans + fuzz * s.albedo);
            }

            half4 SkinFrag(CharVaryings i) : SV_Target
            {
                float2 uv = TRANSFORM_TEX(i.uv, _BaseMap);
                half3 albedo = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, uv).rgb;
                half4 mask = SAMPLE_TEXTURE2D(_MaskMap, sampler_MaskMap, uv);
                half3 nTS = UnpackNormalScale(SAMPLE_TEXTURE2D(_NormalMap, sampler_NormalMap, uv), _NormalStrength);
                half3 nTSBlur = UnpackNormalScale(SAMPLE_TEXTURE2D_BIAS(_NormalMap, sampler_NormalMap, uv, _NormalBlurMip), _NormalStrength);
                half3 dTS = UnpackNormalScale(SAMPLE_TEXTURE2D(_DetailNormalMap, sampler_DetailNormalMap, uv * _DetailTiling), _DetailStrength);
                nTS = normalize(half3(nTS.xy + dTS.xy, nTS.z * dTS.z));

                half3 geomN = normalize(i.normalWS);
                SkinSurface s;
                s.n = CharTangentToWorld(nTS, i, geomN);
                s.nBlur = CharTangentToWorld(nTSBlur, i, geomN);
                s.cavity = mask.b;
                s.ao = mask.r;
                s.translucency = mask.a;
                s.roughness = saturate(mask.g * _RoughnessScale);
                s.albedo = albedo * lerp(1.0h, lerp(0.82h, 1.0h, mask.b), _CavityAlbedo);
                s.f0 = 0.028h * _SpecularLevel;
                // screen-space curvature of the interpolated normal (Penner): |dN| / |dP|
                half dN = length(fwidth(geomN));
                half dP = length(fwidth(i.positionWS));
                s.curvature = dN / max(dP, 1e-5h) * _CurvatureScale;

                InputData inputData = CharInputData(i, s.n);
                half3 V = inputData.viewDirectionWS;
                CharVoxelLight vox = GetCharVoxelLight(_VoxelSky, _VoxelBlock);
                half ssao = CharScreenSpaceAO(inputData.normalizedScreenSpaceUV);
                half occl = s.ao * ssao;

                half3 color = 0;
                Light mainLight = GetMainLight(inputData.shadowCoord, inputData.positionWS, inputData.shadowMask);
                color += SkinLight(mainLight, s, V, vox.direct);
                CHAR_ADDITIONAL_LIGHTS(color, SkinLight(light, s, V, 1.0h))

                // ambient: SH sampled with the blurred normal for the deep (red) scatter
                half3 shDetail = SampleSH(s.n);
                half3 shBlur = SampleSH(s.nBlur);
                half3 irradiance = lerp(shDetail, shBlur, half3(0.8h, 0.45h, 0.25h)) * vox.ambient + vox.block;
                color += s.albedo * irradiance * occl;
                half NoV = saturate(dot(s.n, V));
                half3 R = reflect(-V, s.n);
                half perceptual = sqrt(lerp(s.roughness * 1.25h, s.roughness * 0.75h, _LobeMix));
                half specOcc = saturate(occl * s.cavity * 1.2h);
                half3 env = GlossyEnvironmentReflection(R, inputData.positionWS, perceptual, specOcc, inputData.normalizedScreenSpaceUV);
                color += env * EnvBRDFApprox(s.f0, s.roughness, NoV) * vox.ambient;

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
