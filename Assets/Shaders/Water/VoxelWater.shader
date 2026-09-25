// Phase 5 water: refraction through the opaque scene with per-channel absorption, caustics on what lies
// below, flow-mapped ripples that follow the simulation's slopes (and stream down waterfalls), shoreline and
// rapids foam, Fresnel reflection with a GGX sun highlight, and the surface seen from below. Lighting uses the
// same voxel sky/block light, cloud shadows and fog as the terrain.
Shader "Voxelwild/Water"
{
    Properties
    {
        _ShallowColor ("Shallow Color", Color) = (0.10, 0.42, 0.45, 1)
        _DeepColor ("Deep Color", Color) = (0.015, 0.09, 0.14, 1)
        _Absorption ("Absorption per Metre", Range(0.01, 2)) = 0.28
        _MinAlpha ("Min Alpha (unused since refraction)", Range(0, 1)) = 0.35
        _RippleScale ("Ripple Scale", Float) = 0.9
        _RippleStrength ("Ripple Strength", Range(0, 1)) = 0.22
        _RippleSpeed ("Ripple Speed", Float) = 0.6
        _Smoothness ("Smoothness", Range(0, 1)) = 0.93
        _Refraction ("Refraction", Range(0, 0.1)) = 0.035
        _FlowSpeed ("Flow Speed", Float) = 1.4
        _Foam ("Foam", Range(0, 2)) = 1
        _Caustics ("Caustics", Range(0, 3)) = 1.2
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
            Cull Off

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
            #include "Assets/Shaders/Include/VoxelLighting.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/DeclareDepthTexture.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/DeclareOpaqueTexture.hlsl"
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
                float _Refraction;
                float _FlowSpeed;
                float _Foam;
                float _Caustics;
            CBUFFER_END

            struct Attributes
            {
                float4 positionOS : POSITION;
                float4 d0 : TEXCOORD0;
                float4 d1 : TEXCOORD1;
                float4 d2 : TEXCOORD2;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 positionWS : TEXCOORD0;
                nointerpolation float face : TEXCOORD1;
                float fogFactor : TEXCOORD2;
                float2 light : TEXCOORD3;   // sky, block
                float2 flow : TEXCOORD4;    // downhill direction (xz), 0 on still water
            };

            Varyings Vert(Attributes input)
            {
                Varyings o;
                o.positionWS = TransformObjectToWorld(input.positionOS.xyz);
                o.positionCS = TransformWorldToHClip(o.positionWS);
                VoxelVertex v = DecodeVoxelVertex(input.d0, input.d1, input.d2);
                o.face = v.face;
                o.light = float2(v.sky, v.block);
                o.flow = (round(input.d2.zw * 255.0) - 128.0) / 127.0;
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

            float2 RippleSlope(float2 p, float t)
            {
                const float e = 0.08;
                float h0 = RippleHeight(p, t);
                return float2(RippleHeight(p + float2(e, 0), t) - h0, RippleHeight(p + float2(0, e), t) - h0) / e;
            }

            // Two-phase flow map: the ripple field is dragged along the flow and re-seeded every half cycle,
            // cross-faded so the reset never shows.
            float2 FlowSlope(float2 p, float2 flow, float t)
            {
                float speed = t * _FlowSpeed * 0.5;
                float ph0 = frac(speed), ph1 = frac(speed + 0.5);
                float w0 = 1.0 - abs(1.0 - 2.0 * ph0);
                float2 a = RippleSlope(p - flow * ph0 * 1.5, t * 0.3);
                float2 b = RippleSlope(p - flow * ph1 * 1.5 + 0.37, t * 0.3);
                return a * w0 + b * (1.0 - w0);
            }

            float Caustics(float2 p, float t)
            {
                float a = VoxelValueNoise(p * 1.3 + float2(t * 0.35, t * 0.2));
                float b = VoxelValueNoise(p * 1.3 * 1.07 - float2(t * 0.25, -t * 0.31) + 5.3);
                return pow(saturate(1.0 - abs(a - b) * 3.0), 6.0);
            }

            half4 Frag(Varyings i, bool frontFace : SV_IsFrontFace) : SV_Target
            {
                uint face = (uint)i.face;
                float3 N = kFaceN[face];
                float3 V = GetWorldSpaceNormalizeViewDir(i.positionWS);
                float t = _Time.y * _RippleSpeed;
                float dist = length(i.positionWS - GetCameraPositionWS());
                float rippleFade = 1.0 - saturate(dist / 90.0);
                float flowAmount = length(i.flow);

                if (rippleFade > 0.0)
                {
                    float k = _RippleStrength * rippleFade;
                    if (face == 2u)
                    {
                        float2 p = i.positionWS.xz * _RippleScale;
                        float2 slope = flowAmount > 0.02 ? FlowSlope(p, i.flow, _Time.y) * (1.0 + flowAmount)
                                                         : RippleSlope(p, t);
                        N = normalize(float3(-slope.x * k, 1.0, -slope.y * k));
                    }
                    else if (face != 3u)
                    {
                        // falling water: streaks rushing down the face
                        float3 T = kFaceT[face];
                        float2 p = float2(dot(i.positionWS, T) * 2.0, i.positionWS.y * 0.6 + _Time.y * 2.5 * _FlowSpeed);
                        float2 slope = RippleSlope(p, t);
                        N = normalize(N + (T * slope.x + float3(0, 1, 0) * slope.y) * k * 0.8);
                    }
                }
                bool below = !frontFace;
                if (below) N = -N;

                // scene behind the surface, refracted by the ripples
                float2 screenUV = GetNormalizedScreenSpaceUV(i.positionCS);
                float surfaceEye = LinearEyeDepth(i.positionCS.z, _ZBufferParams);
                float2 offset = N.xz * _Refraction * saturate(1.0 - dist / 60.0);
                float2 refrUV = screenUV + offset;
                float rawDepth = SampleSceneDepth(refrUV);
                if (LinearEyeDepth(rawDepth, _ZBufferParams) < surfaceEye)
                {
                    // the refracted sample hit something in front of the water: use the straight-through view
                    refrUV = screenUV;
                    rawDepth = SampleSceneDepth(screenUV);
                }
                float sceneEye = LinearEyeDepth(rawDepth, _ZBufferParams);
                float thickness = max(0.0, sceneEye - surfaceEye);
                half3 scene = SampleSceneColor(refrUV);

                Light mainLight = GetMainLight(TransformWorldToShadowCoord(i.positionWS));
                float skyAmbient = VoxelSkyAmbient(i.light.x);
                float shadow = mainLight.shadowAttenuation * mainLight.distanceAttenuation * VoxelSkyDirect(i.light.x)
                             * VoxelCloudShadow(i.positionWS);
                half3 ambient = SampleSHPixel(half3(0, 0, 0), float3(0, 1, 0)) * skyAmbient + VoxelBlockIrradiance(i.light.y);

                // caustics on whatever lies beneath the surface
                if (_Caustics > 0 && !below && thickness > 0.05)
                {
                    float3 bottom = ComputeWorldSpacePosition(refrUV, rawDepth, UNITY_MATRIX_I_VP);
                    float depthBelow = max(0.0, i.positionWS.y - bottom.y);
                    float c = Caustics(bottom.xz * 0.9, _Time.y) * exp(-depthBelow * 0.35) * saturate(depthBelow * 3.0);
                    scene += scene * c * shadow * _Caustics * mainLight.color;
                }

                // absorption: red goes first, so deep water turns blue-green; scattering adds the body colour
                float3 absorb = _Absorption * float3(2.2, 0.75, 0.45);
                float3 transmit = exp(-thickness * absorb);
                half3 body = lerp(_ShallowColor.rgb, _DeepColor.rgb, 1.0 - transmit.g);
                half3 refracted = scene * transmit + body * (ambient + mainLight.color * shadow * 0.35) * (1.0 - transmit.g);

                float ndv = saturate(dot(N, V));
                float fresnel = below ? saturate(pow(1.0 - ndv, 3.0) * 1.5) : 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
                half3 R = reflect(-V, N);
                half3 reflection = below
                    ? _DeepColor.rgb * ambient * 0.6                          // total internal reflection: the water's own dark
                    : GlossyEnvironmentReflection(R, i.positionWS, 1.0 - _Smoothness, 1.0, screenUV) * skyAmbient
                      + VoxelBlockIrradiance(i.light.y) * 0.25;

                // GGX sun highlight; roughness grows with distance so sub-pixel ripples don't sparkle
                float3 H = normalize(mainLight.direction + V);
                float ndl = saturate(dot(N, mainLight.direction));
                float rough = lerp(1.0 - _Smoothness, 0.35, saturate(dist / 250.0));
                float a2 = max(rough * rough * rough * rough, 1e-4);
                float nh = saturate(dot(N, H));
                float d = nh * nh * (a2 - 1.0) + 1.0;
                float ggx = a2 / (PI * d * d);
                half3 spec = below ? 0 : mainLight.color * shadow * ndl * min(ggx, 18.0) * fresnel * 0.15;

                half3 color = lerp(refracted, reflection, fresnel) + spec;

                // foam: along shores, on rapids and down waterfalls
                float foamNoise = VoxelValueNoise(i.positionWS.xz * 3.1 + i.flow * _Time.y * 2.0) * 0.6
                                + VoxelValueNoise(i.positionWS.xz * 7.3 - _Time.y * 0.4) * 0.4;
                float shore = 1.0 - smoothstep(0.0, 0.45, thickness);
                float rapids = saturate(flowAmount * 1.2 - 0.2);
                float fall = face != 2u && face != 3u ? 0.55 : 0.0;
                float foam = saturate(max(max(shore * 0.8, rapids), fall) * _Foam * smoothstep(0.35, 0.75, foamNoise + max(shore, fall) * 0.3));
                color = lerp(color, (ambient + mainLight.color * shadow * ndl) * 0.9, foam * (below ? 0.3 : 1.0));

                color = VoxelApplyFog(color, i.positionWS, InitializeInputDataFog(float4(i.positionWS, 1.0), i.fogFactor));
                return half4(color, 1.0);
            }
            ENDHLSL
        }
    }

    FallBack Off
}
