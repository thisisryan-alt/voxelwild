Shader "Voxelwild/Terrain"
{
    Properties
    {
        [NoScaleOffset] _AlbedoArray ("Albedo (RGB) Height/Opacity (A)", 2DArray) = "" {}
        [NoScaleOffset] _NormalArray ("Normal (OpenGL, RGB)", 2DArray) = "" {}
        [NoScaleOffset] _MaskArray ("AO (R) Roughness (G) Metallic (B) Emission (A)", 2DArray) = "" {}
        _BevelWidth ("Bevel Width (blocks)", Range(0.0, 0.25)) = 0.075
        _BevelStrength ("Bevel Strength", Range(0.0, 1.5)) = 0.85
        _EdgeWear ("Edge Wear", Range(0.0, 1.0)) = 0.12
        _VoxelAOStrength ("Voxel AO Strength", Range(0.0, 1.0)) = 0.85
        _VoxelAODirect ("Voxel AO on Direct Light", Range(0.0, 1.0)) = 0.35
        _GrassOverhang ("Grass Overhang on Sides", Range(0.0, 0.6)) = 0.24
        [HideInInspector] _Cutoff ("Alpha Cutoff", Range(0, 1)) = 0.5
        [HideInInspector] _Translucency ("Translucency", Range(0, 2)) = 0
    }

    SubShader
    {
        Tags { "RenderType" = "Opaque" "RenderPipeline" = "UniversalPipeline" "Queue" = "Geometry" "UniversalMaterialType" = "Lit" }

        HLSLINCLUDE
        #pragma target 4.5
        #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
        #include "Assets/Shaders/Include/VoxelLighting.hlsl"
        #include "Assets/Shaders/Include/VoxelTerrainSurface.hlsl"
        #include "Assets/Shaders/Include/VoxelPasses.hlsl"
        ENDHLSL

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }
            Cull Back

            HLSLPROGRAM
            #pragma vertex VoxelForwardVert
            #pragma fragment VoxelForwardFrag
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
            #pragma vertex VoxelShadowVert
            #pragma fragment VoxelShadowFrag
            #pragma multi_compile_vertex _ _CASTING_PUNCTUAL_LIGHT_SHADOW
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
            #pragma vertex VoxelDepthVert
            #pragma fragment VoxelDepthFrag
            ENDHLSL
        }

        Pass
        {
            Name "DepthNormals"
            Tags { "LightMode" = "DepthNormals" }
            ZWrite On
            Cull Back

            HLSLPROGRAM
            #pragma vertex VoxelDepthVert
            #pragma fragment VoxelDepthNormalsFrag
            #pragma multi_compile_fragment _ _GBUFFER_NORMALS_OCT
            ENDHLSL
        }
    }

    FallBack Off
}
