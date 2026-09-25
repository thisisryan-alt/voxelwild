Shader "Voxelwild/Prop"
{
    Properties
    {
        [NoScaleOffset] _AlbedoArray ("Block Albedo Array", 2DArray) = "" {}
        [NoScaleOffset] _NormalArray ("Block Normal Array", 2DArray) = "" {}
        [NoScaleOffset] _MaskArray ("Block Mask Array", 2DArray) = "" {}
        [NoScaleOffset] _BakedNormal ("Baked Normal (UV0)", 2D) = "bump" {}
        [NoScaleOffset] _BakedMask ("Baked AO (R) Curvature (G) Moss (B)", 2D) = "white" {}
        _HasBakedNormal ("Has Baked Normal", Float) = 0
        _HasBakedMask ("Has Baked Mask", Float) = 0
        _Layer ("Texture Layer", Float) = 0
        _MossLayer ("Moss Layer", Float) = 20
        [Enum(Triplanar,0,UV1,1,Vertex Colour,2)] _Mapping ("Mapping", Float) = 0
        _Tiling ("Tiling (repeats per metre)", Float) = 0.5
        _Moss ("Moss", Range(0, 1)) = 0
        _Tint ("Tint", Color) = (1, 1, 1, 1)
        _Roughness ("Roughness Scale", Range(0, 2)) = 1
        _EdgeWear ("Edge Wear", Range(0, 1)) = 0.2
        [MaterialToggle] _Foliage ("Foliage (double-sided, wind, biome tint)", Float) = 0
        [Enum(UnityEngine.Rendering.CullMode)] _Cull ("Cull", Float) = 2
    }

    SubShader
    {
        Tags { "RenderType" = "Opaque" "RenderPipeline" = "UniversalPipeline" "Queue" = "Geometry" "UniversalMaterialType" = "Lit" }

        HLSLINCLUDE
        #pragma target 4.5
        #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
        #include "Assets/Shaders/Include/VoxelLighting.hlsl"
        #include "Assets/Shaders/Include/VoxelPropSurface.hlsl"
        ENDHLSL

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }
            Cull [_Cull]

            HLSLPROGRAM
            #pragma vertex PropForwardVert
            #pragma multi_compile_instancing
            #pragma fragment PropForwardFrag
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

            PropVaryings PropForwardVert(PropAttributes input)
            {
                PropVaryings o = PropVertex(input);
                o.fog = ComputeFogFactor(o.positionCS.z);
                return o;
            }

            half4 PropForwardFrag(PropVaryings i, bool frontFace : SV_IsFrontFace) : SV_Target
            {
                UNITY_SETUP_INSTANCE_ID(i);
                float4 light = PropLight();
                PropSurface s = EvaluatePropSurface(i, frontFace, light);

                InputData inputData = (InputData)0;
                inputData.positionWS = i.positionWS;
                inputData.positionCS = i.positionCS;
                inputData.normalWS = s.normalWS;
                inputData.viewDirectionWS = GetWorldSpaceNormalizeViewDir(i.positionWS);
                inputData.shadowCoord = TransformWorldToShadowCoord(i.positionWS);
                inputData.fogCoord = InitializeInputDataFog(float4(i.positionWS, 1.0), i.fog);
                inputData.normalizedScreenSpaceUV = GetNormalizedScreenSpaceUV(i.positionCS);
                inputData.bakedGI = SampleSHPixel(half3(0, 0, 0), s.normalWS);
                inputData.shadowMask = half4(1, 1, 1, 1);

                SurfaceData surface = (SurfaceData)0;
                surface.albedo = s.albedo;
                surface.metallic = s.metallic;
                surface.smoothness = 1.0 - s.roughness;
                surface.normalTS = half3(0, 0, 1);
                surface.occlusion = s.occlusion * VoxelSkyAmbient(light.x);
                surface.alpha = 1.0;

                half3 blockIrr = VoxelBlockIrradiance(light.y) * s.occlusion;
                half3 transAlbedo = s.albedo * s.translucency;
                half4 color = VoxelFragmentPBR(inputData, surface, VoxelSkyDirect(light.x), blockIrr, transAlbedo, s.specular);
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
            Cull [_Cull]

            HLSLPROGRAM
            #pragma vertex PropShadowVert
            #pragma multi_compile_instancing
            #pragma fragment PropShadowFrag
            #pragma multi_compile_vertex _ _CASTING_PUNCTUAL_LIGHT_SHADOW

            float3 _LightDirection;
            float3 _LightPosition;

            float4 PropShadowVert(PropAttributes input) : SV_POSITION
            {
                PropVaryings v = PropVertex(input);
                float3 normalWS = normalize(v.normalWS);
            #if _CASTING_PUNCTUAL_LIGHT_SHADOW
                float3 lightDirectionWS = normalize(_LightPosition - v.positionWS);
            #else
                float3 lightDirectionWS = _LightDirection;
            #endif
                return ApplyShadowClamping(TransformWorldToHClip(ApplyShadowBias(v.positionWS, normalWS, lightDirectionWS)));
            }

            half4 PropShadowFrag() : SV_Target { return 0; }
            ENDHLSL
        }

        Pass
        {
            Name "DepthOnly"
            Tags { "LightMode" = "DepthOnly" }
            ZWrite On
            ColorMask R
            Cull [_Cull]

            HLSLPROGRAM
            #pragma vertex PropDepthVert
            #pragma multi_compile_instancing
            #pragma fragment PropDepthFrag

            float4 PropDepthVert(PropAttributes input) : SV_POSITION
            {
                return PropVertex(input).positionCS;
            }

            half PropDepthFrag(float4 positionCS : SV_POSITION) : SV_Target { return positionCS.z; }
            ENDHLSL
        }

        Pass
        {
            Name "DepthNormals"
            Tags { "LightMode" = "DepthNormals" }
            ZWrite On
            Cull [_Cull]

            HLSLPROGRAM
            #pragma vertex PropVertex
            #pragma multi_compile_instancing
            #pragma fragment PropDepthNormalsFrag
            #pragma multi_compile_fragment _ _GBUFFER_NORMALS_OCT

            half4 PropDepthNormalsFrag(PropVaryings i, bool frontFace : SV_IsFrontFace) : SV_Target
            {
                UNITY_SETUP_INSTANCE_ID(i);
                float3 n = normalize(i.normalWS);
                if (_Foliage > 0.5 && !frontFace) n = -n;
                float3 normalWS = PropBakedNormal(i, n);
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
