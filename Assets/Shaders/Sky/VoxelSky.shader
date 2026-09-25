// Physically based sky for the day/night cycle: single-scattering atmosphere from a precomputed table
// (AtmosphereModel.cs), limb-darkened sun disc and halo, a moon with its phase, twinkling stars, and the
// cloud layer whose shadows fall on the terrain (VoxelAtmosphere.hlsl). Toward the horizon it blends into
// the fog colour so the edge of the loaded world disappears into it.
Shader "Voxelwild/Sky"
{
    Properties
    {
        _StarDensity ("Star Density", Range(0.99, 0.9999)) = 0.9975
        _StarBrightness ("Star Brightness", Range(0, 8)) = 2.5
        _MoonSize ("Moon Angular Radius (deg)", Range(0.2, 5)) = 1.6
        _SunSize ("Sun Angular Radius (deg)", Range(0.1, 3)) = 0.6
        _HorizonFog ("Horizon Fog Blend", Range(0, 0.4)) = 0.12
    }

    SubShader
    {
        Tags { "Queue" = "Background" "RenderType" = "Background" "PreviewType" = "Skybox" "RenderPipeline" = "UniversalPipeline" }
        Cull Off
        ZWrite Off

        Pass
        {
            HLSLPROGRAM
            #pragma target 4.5
            #pragma vertex Vert
            #pragma fragment Frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Assets/Shaders/Include/VoxelAtmosphere.hlsl"

            TEXTURE2D(_VoxelSkyLut);
            SAMPLER(sampler_VoxelSkyLut);

            CBUFFER_START(UnityPerMaterial)
                float _StarDensity;
                float _StarBrightness;
                float _MoonSize;
                float _SunSize;
                float _HorizonFog;
            CBUFFER_END

            // must match AtmosphereModel.cs
            static const float3 kRayleigh = float3(5.8e-6, 13.5e-6, 33.1e-6);
            static const float kMie = 21e-6;
            static const float kMieG = 0.76;

            struct Attributes { float4 positionOS : POSITION; };
            struct Varyings { float4 positionCS : SV_POSITION; float3 dir : TEXCOORD0; };

            Varyings Vert(Attributes input)
            {
                Varyings o;
                o.positionCS = TransformObjectToHClip(input.positionOS.xyz);
                o.dir = input.positionOS.xyz;
                return o;
            }

            float2 LutUV(float muView, float muSun)
            {
                float u = 0.5 + 0.5 * sign(muView) * sqrt(abs(muView));
                float v = saturate((muSun + 0.35) / 1.35);
                return float2(u, v);
            }

            float3 Scattering(float3 V, float3 L)
            {
                float4 t = SAMPLE_TEXTURE2D_LOD(_VoxelSkyLut, sampler_VoxelSkyLut, LutUV(V.y, L.y), 0);
                float c = dot(V, L);
                float rayleighPhase = 3.0 / (16.0 * PI) * (1.0 + c * c);
                float g2 = kMieG * kMieG;
                float miePhase = 3.0 / (8.0 * PI) * (1.0 - g2) * (1.0 + c * c)
                               / ((2.0 + g2) * pow(max(1.0 + g2 - 2.0 * kMieG * c, 1e-4), 1.5));
                float3 mie = t.xyz * (t.w / max(t.x, 1e-12)) * (kRayleigh.x / kRayleigh);
                return t.xyz * rayleighPhase + mie * miePhase;
            }

            float Hash31(float3 p)
            {
                p = frac(p * 0.1031);
                p += dot(p, p.zyx + 31.32);
                return frac((p.x + p.y) * p.z);
            }

            float3 Stars(float3 V)
            {
                float3 p = V * 380.0;
                float3 cell = floor(p);
                float h = Hash31(cell);
                if (h < _StarDensity) return 0;
                float3 centre = cell + 0.5 + (float3(Hash31(cell + 1.7), Hash31(cell + 5.3), Hash31(cell + 9.1)) - 0.5) * 0.6;
                float d = length(p - centre);
                float twinkle = 0.7 + 0.3 * sin(_Time.y * (2.0 + h * 5.0) + h * 100.0);
                float b = saturate(1.0 - d * 2.2) * (h - _StarDensity) / (1.0 - _StarDensity);
                float3 tint = lerp(float3(1.0, 0.82, 0.7), float3(0.75, 0.85, 1.0), Hash31(cell + 3.1));
                return tint * b * b * twinkle * _StarBrightness;
            }

            // Moon disc lit from the sun's side according to the phase; dark side faintly earth-lit.
            float3 Moon(float3 V, float3 M, float phase)
            {
                float r = radians(_MoonSize);
                float c = dot(V, M);
                if (c < cos(r * 1.05)) return 0;
                float3 right = normalize(cross(float3(0, 1, 0), M));
                float3 up = cross(M, right);
                float2 q = float2(dot(V, right), dot(V, up)) / sin(r);
                float rr = dot(q, q);
                if (rr > 1.0) return 0;
                float3 n = float3(q, sqrt(1.0 - rr));
                float a = phase * 2.0 * PI;                    // 0 new, pi full
                float3 light = float3(sin(a), 0, -cos(a));      // lit from behind at new moon, from the front when full
                float lit = saturate(dot(n, light) * 4.0 + 0.5);
                float mare = 0.8 + 0.2 * VoxelCloudNoise(q * 3.0 + 4.0);
                return float3(0.9, 0.92, 1.0) * mare * (lit * 1.4 + 0.02);
            }

            half4 Frag(Varyings i) : SV_Target
            {
                float3 V = normalize(i.dir);
                float3 S = _VoxelSunDir.xyz;
                float3 M = _VoxelMoonDir.xyz;
                float exposure = _VoxelSkyParams.x;
                float mu = max(V.y, -0.02);

                float3 viewDir = float3(V.x, mu, V.z);
                float3 sky = Scattering(viewDir, S) * exposure;
                // moonlit night sky: the same scattering with the moon as a much dimmer sun
                sky += Scattering(viewDir, M) * exposure * 0.0035 * _VoxelSkyParams.z;

                float night = _VoxelSkyParams.y;
                float above = smoothstep(-0.02, 0.03, V.y);
                sky += Stars(V) * night * above;
                sky += Moon(V, M, _VoxelMoonDir.w) * above * lerp(0.35, 1.0, night);

                // sun: limb-darkened disc and a soft halo, both dimmed by the atmosphere
                float cs = dot(V, S);
                float sunR = radians(_SunSize);
                float disc = smoothstep(cos(sunR), cos(sunR * 0.85), cs);
                float limb = sqrt(saturate(1.0 - pow(acos(min(cs, 1.0)) / sunR, 2.0)));
                sky += _VoxelSunTransmittance.rgb * (disc * (0.4 + 0.6 * limb) * _VoxelSkyParams.w + pow(saturate(cs), 900.0) * 3.0) * above;

                // clouds on a plane at the cloud altitude
                if (V.y > 0.005 && _VoxelClouds.x > 0.001)
                {
                    float3 cam = GetCameraPositionWS();
                    float dist = (_VoxelClouds.z - cam.y) / V.y;
                    float2 xz = cam.xz + V.xz * dist;
                    float density = VoxelCloudDensity(xz);
                    if (density > 0.001)
                    {
                        // light passing through the cloud toward the sun: thicker further along means darker
                        float toward = VoxelCloudDensity(xz + S.xz / max(S.y, 0.15) * 60.0);
                        float lit = exp(-toward * 2.5);
                        float silver = pow(saturate(dot(V, S)), 6.0) * (1.0 - density);
                        float3 sunLit = _VoxelSunColor.rgb * (0.22 * lit + silver * 0.6);
                        float3 ambient = _VoxelAmbientSkyColor.rgb * 0.55 + sky * 0.25;
                        float3 cloud = ambient + sunLit;
                        float fade = smoothstep(0.005, 0.12, V.y) * saturate(1.0 - dist / 12000.0);
                        sky = lerp(sky, cloud, saturate(density * 1.4) * fade);
                    }
                }

                // blend into the world's fog toward and below the horizon
                float horizon = 1.0 - smoothstep(-0.02, _HorizonFog, V.y);
                sky = lerp(sky, unity_FogColor.rgb, horizon);
                return half4(sky, 1.0);
            }
            ENDHLSL
        }
    }

    FallBack Off
}
