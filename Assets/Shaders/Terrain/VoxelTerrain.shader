Shader "Voxelwild/Terrain"
{
    Properties
    {
        [NoScaleOffset] _AlbedoArray ("Albedo (RGB) Height (A)", 2DArray) = "" {}
        [NoScaleOffset] _NormalArray ("Normal (OpenGL, RGB)", 2DArray) = "" {}
        [NoScaleOffset] _MaskArray ("AO (R) Roughness (G) Metallic (B)", 2DArray) = "" {}
        _BevelWidth ("Bevel Width (blocks)", Range(0.0, 0.25)) = 0.075
        _BevelStrength ("Bevel Strength", Range(0.0, 1.5)) = 0.85
        _EdgeWear ("Edge Wear", Range(0.0, 1.0)) = 0.12
        _VoxelAOStrength ("Voxel AO Strength", Range(0.0, 1.0)) = 0.85
        _VoxelAODirect ("Voxel AO on Direct Light", Range(0.0, 1.0)) = 0.35
        _GrassOverhang ("Grass Overhang on Sides", Range(0.0, 0.6)) = 0.24
    }

    SubShader
    {
        Tags { "RenderType" = "Opaque" "RenderPipeline" = "UniversalPipeline" "Queue" = "Geometry" "UniversalMaterialType" = "Lit" }

        HLSLINCLUDE
        #pragma target 4.5
        #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
        #include "Assets/Shaders/Include/VoxelTerrainSurface.hlsl"

        struct VoxelAttributes
        {
            float4 positionOS : POSITION;
            float4 packed     : TEXCOORD0;
        };
        ENDHLSL

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }

            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment Frag

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

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 positionWS : TEXCOORD0;
                nointerpolation float4 faceData : TEXCOORD1;   // face, edges, layer, overlay
                float ao : TEXCOORD2;
                float fogFactor : TEXCOORD3;
            };

            Varyings Vert(VoxelAttributes input)
            {
                Varyings o;
                o.positionWS = TransformObjectToWorld(input.positionOS.xyz);
                o.positionCS = TransformWorldToHClip(o.positionWS);
                VoxelVertexData v = DecodeVoxelVertex(input.packed);
                o.faceData = float4(v.face, v.edges, v.layer, v.overlay);
                o.ao = v.ao;
                o.fogFactor = ComputeFogFactor(o.positionCS.z);
                return o;
            }

            half4 Frag(Varyings i) : SV_Target
            {
                VoxelVertexData v;
                v.face = (uint)i.faceData.x;
                v.edges = (uint)i.faceData.y;
                v.layer = (uint)i.faceData.z;
                v.overlay = (uint)i.faceData.w;
                v.ao = i.ao;
                VoxelSurface s = EvaluateVoxelSurface(i.positionWS, v);

                InputData inputData = (InputData)0;
                inputData.positionWS = i.positionWS;
                inputData.positionCS = i.positionCS;
                inputData.normalWS = s.normalWS;
                inputData.viewDirectionWS = GetWorldSpaceNormalizeViewDir(i.positionWS);
                inputData.shadowCoord = TransformWorldToShadowCoord(i.positionWS);
                inputData.fogCoord = InitializeInputDataFog(float4(i.positionWS, 1.0), i.fogFactor);
                inputData.normalizedScreenSpaceUV = GetNormalizedScreenSpaceUV(i.positionCS);
                inputData.bakedGI = SampleSHPixel(half3(0, 0, 0), s.normalWS);
                inputData.shadowMask = half4(1, 1, 1, 1);

                SurfaceData surface = (SurfaceData)0;
                surface.albedo = s.albedo * s.directShade;
                surface.metallic = s.metallic;
                surface.specular = half3(0, 0, 0);
                surface.smoothness = 1.0 - s.roughness;
                surface.normalTS = half3(0, 0, 1);
                surface.occlusion = s.occlusion;
                surface.alpha = 1.0;

                half4 color = UniversalFragmentPBR(inputData, surface);
                color.rgb = MixFog(color.rgb, inputData.fogCoord);
                color.a = 1.0;
                return color;
            }
            ENDHLSL
        }

        Pass
        {
            Name "ShadowCaster"
            Tags { "LightMode" = "ShadowCaster" }
            ZWrite On
            ZTest LEqual
            ColorMask 0
            Cull Back

            HLSLPROGRAM
            #pragma vertex ShadowVert
            #pragma fragment ShadowFrag
            #pragma multi_compile_vertex _ _CASTING_PUNCTUAL_LIGHT_SHADOW
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Shadows.hlsl"

            float3 _LightDirection;
            float3 _LightPosition;

            float4 ShadowVert(VoxelAttributes input) : SV_POSITION
            {
                float3 positionWS = TransformObjectToWorld(input.positionOS.xyz);
                float3 normalWS = kFaceN[DecodeVoxelVertex(input.packed).face];
            #if _CASTING_PUNCTUAL_LIGHT_SHADOW
                float3 lightDirectionWS = normalize(_LightPosition - positionWS);
            #else
                float3 lightDirectionWS = _LightDirection;
            #endif
                float4 positionCS = TransformWorldToHClip(ApplyShadowBias(positionWS, normalWS, lightDirectionWS));
                return ApplyShadowClamping(positionCS);
            }

            half4 ShadowFrag() : SV_Target { return 0; }
            ENDHLSL
        }

        Pass
        {
            Name "DepthOnly"
            Tags { "LightMode" = "DepthOnly" }
            ZWrite On
            ColorMask R
            Cull Back

            HLSLPROGRAM
            #pragma vertex DepthVert
            #pragma fragment DepthFrag

            float4 DepthVert(VoxelAttributes input) : SV_POSITION
            {
                return TransformObjectToHClip(input.positionOS.xyz);
            }

            half DepthFrag(float4 positionCS : SV_POSITION) : SV_Target { return positionCS.z; }
            ENDHLSL
        }

        Pass
        {
            Name "DepthNormals"
            Tags { "LightMode" = "DepthNormals" }
            ZWrite On
            Cull Back

            HLSLPROGRAM
            #pragma vertex DNVert
            #pragma fragment DNFrag
            #pragma multi_compile_fragment _ _GBUFFER_NORMALS_OCT

            struct DNVaryings
            {
                float4 positionCS : SV_POSITION;
                float3 positionWS : TEXCOORD0;
                nointerpolation float4 faceData : TEXCOORD1;
            };

            DNVaryings DNVert(VoxelAttributes input)
            {
                DNVaryings o;
                o.positionWS = TransformObjectToWorld(input.positionOS.xyz);
                o.positionCS = TransformWorldToHClip(o.positionWS);
                VoxelVertexData v = DecodeVoxelVertex(input.packed);
                o.faceData = float4(v.face, v.edges, v.layer, v.overlay);
                return o;
            }

            half4 DNFrag(DNVaryings i) : SV_Target
            {
                VoxelVertexData v;
                v.face = (uint)i.faceData.x;
                v.edges = (uint)i.faceData.y;
                v.layer = (uint)i.faceData.z;
                v.overlay = (uint)i.faceData.w;
                v.ao = 1;
                float3 normalWS = EvaluateVoxelSurface(i.positionWS, v).normalWS;
            #if defined(_GBUFFER_NORMALS_OCT)
                float2 octNormalWS = PackNormalOctQuadEncode(normalWS);
                float2 remapped = saturate(octNormalWS * 0.5 + 0.5);
                return half4(PackFloat2To888(remapped), 0.0);
            #else
                return half4(NormalizeNormalPerPixel(normalWS), 0.0);
            #endif
            }
            ENDHLSL
        }
    }

    FallBack Off
}
