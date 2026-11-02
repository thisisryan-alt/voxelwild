// Eye occlusion shell: a multiplicative soft shadow over the eyeball along the lid margin (UV v = 0 at
// the margin, 1 at the open-eye centre), stronger under the upper lid (vertex colour R = 1 under the
// upper lid, 0 under the lower). Replaces the contact shadowing that path tracing gets for free from the
// lids and lashes and that SSAO is too coarse to resolve.
Shader "Voxelwild/Character/EyeOcclusion"
{
    Properties
    {
        _OcclusionColor ("Occlusion Tint RGB (linear)", Vector) = (0.32, 0.22, 0.20, 0)
        _Strength ("Strength", Range(0, 1)) = 0.8
        _Width ("Width (UV v)", Range(0.05, 1)) = 0.45
        _TopBoost ("Upper Lid Boost", Range(0, 2)) = 0.9
    }

    SubShader
    {
        Tags { "RenderType" = "Transparent" "RenderPipeline" = "UniversalPipeline" "Queue" = "Transparent-10" }

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }
            Blend DstColor Zero
            ZWrite Off

            HLSLPROGRAM
            #pragma target 4.5
            #pragma vertex OccVert
            #pragma fragment OccFrag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            CBUFFER_START(UnityPerMaterial)
                half4 _OcclusionColor;
                half _Strength, _Width, _TopBoost;
            CBUFFER_END

            struct OccAttributes { float4 positionOS : POSITION; float2 uv : TEXCOORD0; half4 color : COLOR; };
            struct OccVaryings { float4 positionCS : SV_POSITION; float2 uv : TEXCOORD0; half upper : TEXCOORD1; };

            OccVaryings OccVert(OccAttributes v)
            {
                OccVaryings o;
                o.positionCS = TransformObjectToHClip(v.positionOS.xyz);
                o.uv = v.uv;
                o.upper = v.color.r;
                return o;
            }

            half4 OccFrag(OccVaryings i) : SV_Target
            {
                half edge = 1.0h - smoothstep(0.0h, _Width * (1.0h + i.upper * 0.6h), i.uv.y);
                half occ = saturate(edge * edge * _Strength * (1.0h + i.upper * _TopBoost));
                return half4(lerp(1.0h.xxx, _OcclusionColor.rgb, occ), 1);
            }
            ENDHLSL
        }
    }

    FallBack Off
}
