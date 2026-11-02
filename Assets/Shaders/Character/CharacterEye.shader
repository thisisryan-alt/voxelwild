// Inner eye: sclera and iris (two materials, one shader). The cornea is a separate transparent shell
// (Voxelwild/Character/Cornea) that carries the wet specular; this shader is diffuse-dominant.
//  - sclera: soft wrapped diffuse with a warm scatter tint (it is a translucent tissue);
//  - iris: the iris disc sits ~2.5 mm behind the cornea apex in the mesh, so parallax is geometric;
//    light focused by the cornea brightens the iris on the side away from the light (caustic);
//    pupil dilation by radial UV remap (iris texture: limbus at uv radius 0.49, pupil 0.263 of that).
Shader "Voxelwild/Character/Eye"
{
    Properties
    {
        [MainTexture] _BaseMap ("Base Color", 2D) = "white" {}
        [Normal][NoScaleOffset] _NormalMap ("Normal (iris relief)", 2D) = "bump" {}
        _NormalStrength ("Normal Strength", Range(0, 2)) = 0.6
        [Toggle(_EYE_IRIS)] _Iris ("Iris", Float) = 0
        _PupilScale ("Pupil Scale (dilation)", Range(0.5, 1.8)) = 1
        _Roughness ("Roughness", Range(0, 1)) = 0.5
        _ScatterColor ("Scatter Colour", Color) = (0.9, 0.5, 0.4, 1)
        _Wrap ("Diffuse Wrap", Range(0, 1)) = 0.35
        _Caustic ("Iris Caustic", Range(0, 2)) = 0.6
        _Brightness ("Brightness", Range(0.2, 2)) = 1
        _VoxelSky ("Voxel Sky Light", Range(0, 1)) = 1
        _VoxelBlock ("Voxel Block Light", Range(0, 1)) = 0
    }

    SubShader
    {
        Tags { "RenderType" = "Opaque" "RenderPipeline" = "UniversalPipeline" "Queue" = "Geometry+10" }

        HLSLINCLUDE
        #pragma target 4.5
        #include "Assets/Shaders/Character/Include/CharacterCommon.hlsl"
        TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);
        TEXTURE2D(_NormalMap); SAMPLER(sampler_NormalMap);
        CBUFFER_START(UnityPerMaterial)
            float4 _BaseMap_ST;
            half _NormalStrength, _PupilScale, _Roughness;
            half4 _ScatterColor;
            half _Wrap, _Caustic, _Brightness, _VoxelSky, _VoxelBlock, _Iris;
        CBUFFER_END
        ENDHLSL

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }

            HLSLPROGRAM
            #pragma vertex CharVert
            #pragma fragment EyeFrag
            #pragma shader_feature_local _EYE_IRIS
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile _ _ADDITIONAL_LIGHTS
            #pragma multi_compile_fragment _ _ADDITIONAL_LIGHT_SHADOWS
            #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
            #pragma multi_compile_fragment _ _SCREEN_SPACE_OCCLUSION
            #pragma multi_compile _ _LIGHT_LAYERS
            #pragma multi_compile _ _CLUSTER_LIGHT_LOOP
            #include_with_pragmas "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Fog.hlsl"

            float2 PupilRemap(float2 uv)
            {
                const half limbus = 0.49h;
                const half p0 = 0.263h;
                float2 d = uv - 0.5;
                half r = length(d) / limbus;
                half p1 = clamp(p0 * _PupilScale, 0.08h, 0.8h);
                half rs = r < p1 ? r * p0 / p1 : p0 + (r - p1) * (1.0h - p0) / (1.0h - p1);
                rs = r > 1.0h ? r : rs;
                return 0.5 + d * (rs / max(r, 1e-4h));
            }

            half3 EyeLight(Light light, half3 n, half3 albedo, half directScale, half3 irisAxis)
            {
                half3 L = light.direction;
                half NoL = dot(n, L);
                half3 w = _Wrap * _ScatterColor.rgb;
                half3 diff = saturate((NoL + w) / (1.0h + w));
                half shadow = light.shadowAttenuation * directScale;
                half3 c = albedo * diff;
            #if defined(_EYE_IRIS)
                // the cornea focuses light onto the iris on the side opposite the light
                half3 lt = L - irisAxis * dot(L, irisAxis);
                half caustic = saturate(dot(-n, normalize(lt + 1e-4h))) * saturate(dot(irisAxis, L) + 0.3h);
                c += albedo * caustic * _Caustic;
            #endif
                return c * light.color * light.distanceAttenuation * shadow;
            }

            half4 EyeFrag(CharVaryings i) : SV_Target
            {
                float2 uv = TRANSFORM_TEX(i.uv, _BaseMap);
            #if defined(_EYE_IRIS)
                uv = PupilRemap(uv);
            #endif
                half3 albedo = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, uv).rgb * _Brightness;
                half3 geomN = normalize(i.normalWS);
                half3 n = geomN;
            #if defined(_EYE_IRIS)
                half3 nTS = UnpackNormalScale(SAMPLE_TEXTURE2D(_NormalMap, sampler_NormalMap, uv), _NormalStrength);
                n = CharTangentToWorld(nTS, i, geomN);
                half3 irisAxis = geomN;
            #else
                half3 irisAxis = geomN;
            #endif
                InputData inputData = CharInputData(i, n);
                CharVoxelLight vox = GetCharVoxelLight(_VoxelSky, _VoxelBlock);
                half3 color = 0;
                Light mainLight = GetMainLight(inputData.shadowCoord, inputData.positionWS, inputData.shadowMask);
                color += EyeLight(mainLight, n, albedo, vox.direct, irisAxis);
                CHAR_ADDITIONAL_LIGHTS(color, EyeLight(light, n, albedo, 1.0h, irisAxis))
                color += albedo * (SampleSH(n) * vox.ambient + vox.block) * CharScreenSpaceAO(inputData.normalizedScreenSpaceUV);
                color = MixFog(color, inputData.fogCoord);
                return half4(color, 1);
            }
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
