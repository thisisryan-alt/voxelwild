// Phase 1 water: depth-based absorption, Fresnel environment reflection, sun specular and animated
// ripple normals on block-water surfaces. Refraction, SSR, foam, caustics and underwater rendering
// arrive with the Phase 5 water system.
Shader "Voxelwild/Water"
{
    Properties
    {
        _ShallowColor ("Shallow Color", Color) = (0.10, 0.42, 0.45, 1)
        _DeepColor ("Deep Color", Color) = (0.015, 0.09, 0.14, 1)
        _Absorption ("Absorption per Metre", Range(0.01, 2)) = 0.28
        _MinAlpha ("Min Alpha", Range(0, 1)) = 0.35
        _RippleScale ("Ripple Scale", Float) = 0.9
        _RippleStrength ("Ripple Strength", Range(0, 1)) = 0.22
        _RippleSpeed ("Ripple Speed", Float) = 0.6
        _Smoothness ("Smoothness", Range(0, 1)) = 0.93
    }

    SubShader
    {
        Tags { "RenderType" = "Transparent" "Queue" = "Transparent" "RenderPipeline" = "UniversalPipeline" }

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }
            Blend SrcAlpha OneMinusSrcAlpha
            ZWrite Off
            Cull Back

            HLSLPROGRAM
            #pragma target 4.5
            #pragma vertex Vert
            #pragma fragment Frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
            #pragma multi_compile_fragment _ _REFLECTION_PROBE_BLENDING
            #pragma multi_compile_fragment _ _REFLECTION_PROBE_BOX_PROJECTION
            #pragma multi_compile_fragment _ _REFLECTION_PROBE_ATLAS
            #pragma multi_compile _ _CLUSTER_LIGHT_LOOP
            #include_with_pragmas "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Fog.hlsl"

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/DeclareDepthTexture.hlsl"
            #include "Assets/Shaders/Include/VoxelCommon.hlsl"

            CBUFFER_START(UnityPerMaterial)
                half4 _ShallowColor;
                half4 _DeepColor;
                float _Absorption;
                float _MinAlpha;
                float _RippleScale;
                float _RippleStrength;
                float _RippleSpeed;
                float _Smoothness;
            CBUFFER_END

            struct Attributes
            {
                float4 positionOS : POSITION;
                float4 packed : TEXCOORD0;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 positionWS : TEXCOORD0;
                nointerpolation float face : TEXCOORD1;
                float fogFactor : TEXCOORD2;
            };

            Varyings Vert(Attributes input)
            {
                Varyings o;
                o.positionWS = TransformObjectToWorld(input.positionOS.xyz);
                o.positionCS = TransformWorldToHClip(o.positionWS);
                o.face = DecodeVoxelVertex(input.packed).face;
                o.fogFactor = ComputeFogFactor(o.positionCS.z);
                return o;
            }

            // Height of a small ripple field; normal comes from its finite-difference gradient.
            float RippleHeight(float2 p, float t)
            {
                float h = VoxelValueNoise(p * 1.0 + float2(t * 0.9, t * 0.4));
                h += VoxelValueNoise(p * 2.3 - float2(t * 0.5, t * 1.1)) * 0.5;
                h += VoxelValueNoise(p * 5.1 + float2(t * 1.7, -t * 1.3)) * 0.25;
                return h;
            }

            half4 Frag(Varyings i) : SV_Target
            {
                uint face = (uint)i.face;
                float3 N = kFaceN[face];
                float3 V = GetWorldSpaceNormalizeViewDir(i.positionWS);

                float rippleFade = 1.0 - saturate(length(i.positionWS - GetCameraPositionWS()) / 160.0);
                if (face == 2u && rippleFade > 0.0)
                {
                    float t = _Time.y * _RippleSpeed;
                    float2 p = i.positionWS.xz * _RippleScale;
                    const float e = 0.08;
                    float h0 = RippleHeight(p, t);
                    float hx = RippleHeight(p + float2(e, 0), t);
                    float hz = RippleHeight(p + float2(0, e), t);
                    float k = _RippleStrength * rippleFade;
                    N = normalize(float3(-(hx - h0) / e * k, 1.0, -(hz - h0) / e * k));
                }

                // Water thickness along the view ray from the opaque depth behind it.
                float2 screenUV = GetNormalizedScreenSpaceUV(i.positionCS);
                float sceneEye = LinearEyeDepth(SampleSceneDepth(screenUV), _ZBufferParams);
                float surfaceEye = LinearEyeDepth(i.positionCS.z, _ZBufferParams);
                float thickness = max(0.0, sceneEye - surfaceEye);
                float absorb = 1.0 - exp(-thickness * _Absorption);

                Light mainLight = GetMainLight(TransformWorldToShadowCoord(i.positionWS));
                float shadow = mainLight.shadowAttenuation * mainLight.distanceAttenuation;
                float ndl = saturate(dot(N, mainLight.direction));

                half3 ambient = SampleSHPixel(half3(0, 0, 0), float3(0, 1, 0));
                half3 body = lerp(_ShallowColor.rgb, _DeepColor.rgb, absorb);
                half3 diffuse = body * (ambient + mainLight.color * ndl * shadow * 0.6);

                float fresnel = 0.02 + 0.98 * pow(1.0 - saturate(dot(N, V)), 5.0);
                half3 R = reflect(-V, N);
                half3 reflection = GlossyEnvironmentReflection(R, i.positionWS, 1.0 - _Smoothness, 1.0, screenUV);

                // GGX sun highlight; roughness grows with distance so sub-pixel ripples don't sparkle.
                float3 H = normalize(mainLight.direction + V);
                float dist = length(i.positionWS - GetCameraPositionWS());
                float rough = lerp(1.0 - _Smoothness, 0.35, saturate(dist / 250.0));
                float a2 = max(rough * rough * rough * rough, 1e-4);
                float nh = saturate(dot(N, H));
                float d = nh * nh * (a2 - 1.0) + 1.0;
                float ggx = a2 / (PI * d * d);
                half3 spec = mainLight.color * shadow * ndl * min(ggx, 60.0) * fresnel * 0.25;

                half3 color = lerp(diffuse, reflection, fresnel) + spec;
                float alpha = saturate(max(lerp(_MinAlpha, 1.0, absorb), fresnel));
                color = MixFog(color, InitializeInputDataFog(float4(i.positionWS, 1.0), i.fogFactor));
                return half4(color, alpha);
            }
            ENDHLSL
        }
    }

    FallBack Off
}
