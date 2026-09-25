// Rain streaks and snowflakes for the weather particle systems: procedural shapes (no textures), lit by the
// sky ambient and the sun like everything else, and fogged the same way.
Shader "Voxelwild/Precipitation"
{
    Properties
    {
        [Enum(Rain,0,Snow,1)] _Shape ("Shape", Float) = 0
        _Opacity ("Opacity", Range(0, 1)) = 0.35
    }

    SubShader
    {
        Tags { "RenderType" = "Transparent" "Queue" = "Transparent+20" "RenderPipeline" = "UniversalPipeline" "IgnoreProjector" = "True" }
        Blend SrcAlpha OneMinusSrcAlpha
        ZWrite Off
        Cull Off

        Pass
        {
            Name "Unlit"
            Tags { "LightMode" = "UniversalForward" }

            HLSLPROGRAM
            #pragma target 4.5
            #pragma vertex Vert
            #pragma fragment Frag
            #include_with_pragmas "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Fog.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Assets/Shaders/Include/VoxelLighting.hlsl"

            CBUFFER_START(UnityPerMaterial)
                float _Shape;
                float _Opacity;
            CBUFFER_END

            struct Attributes { float4 positionOS : POSITION; float4 color : COLOR; float2 uv : TEXCOORD0; };
            struct Varyings { float4 positionCS : SV_POSITION; float4 color : COLOR; float2 uv : TEXCOORD0; float3 positionWS : TEXCOORD1; float fog : TEXCOORD2; };

            Varyings Vert(Attributes input)
            {
                Varyings o;
                o.positionWS = TransformObjectToWorld(input.positionOS.xyz);
                o.positionCS = TransformWorldToHClip(o.positionWS);
                o.color = input.color;
                o.uv = input.uv;
                o.fog = ComputeFogFactor(o.positionCS.z);
                return o;
            }

            half4 Frag(Varyings i) : SV_Target
            {
                float2 c = i.uv * 2.0 - 1.0;
                float shape = _Shape < 0.5
                    ? saturate(1.0 - abs(c.x) * 1.4) * smoothstep(1.0, 0.2, abs(c.y))      // thin streak, soft ends
                    : saturate(1.0 - dot(c, c)) * saturate(1.0 - dot(c, c));               // round flake
                half3 light = _VoxelAmbientSkyColor.rgb * 0.9 + _VoxelSunColor.rgb * 0.15;
                half3 color = light * (_Shape < 0.5 ? half3(0.8, 0.85, 0.9) : half3(1.0, 1.0, 1.0)) * i.color.rgb;
                color = VoxelApplyFog(color, i.positionWS, i.fog);
                return half4(color, shape * _Opacity * i.color.a);
            }
            ENDHLSL
        }
    }

    FallBack Off
}
