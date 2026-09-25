#ifndef VOXELWILD_ATMOSPHERE_INCLUDED
#define VOXELWILD_ATMOSPHERE_INCLUDED

// Time of day, clouds and fog shared by the sky and every lit Voxelwild shader. DayNightCycle (C#) sets the
// globals each frame; WeatherSystem changes cloud cover, fog and wetness through it.
//
// The cloud layer is one density field over world XZ at a fixed altitude. The sky draws it; lit surfaces
// sample the same field along the sun direction for cloud shadows, so shadows move with the clouds above.

float4 _VoxelSunDir;            // xyz toward the sun, w directional light intensity
float4 _VoxelMoonDir;           // xyz toward the moon, w phase (0 new, 0.5 full)
float4 _VoxelSunColor;          // rgb linear directional light colour x intensity
float4 _VoxelSunTransmittance;  // rgb sunlight left after the atmosphere (sun disc)
float4 _VoxelAmbientSkyColor;   // rgb linear sky ambient
float4 _VoxelSkyParams;         // x sky exposure, y star visibility, z moon illumination, w sun disc intensity
float4 _VoxelClouds;            // x coverage 0..1, y density 0..1, z altitude (m), w feature scale (1/m)
float4 _VoxelCloudOffset;       // xy wind offset (m), z shadow strength, w shadows enabled
float4 _VoxelFogParams;         // x height-fog base (m), y falloff (1/m), z density, w sun scatter
float4 _VoxelFogSun;            // rgb linear colour of fog lit toward the sun
float4 _VoxelWeather;           // x wetness, y snow cover, z puddles (0..1), w snow texture layer

float VoxelCloudHash(float2 p)
{
    p = frac(p * float2(0.1031, 0.1030));
    p += dot(p, p.yx + 33.33);
    return frac((p.x + p.y) * p.x);
}

float VoxelCloudNoise(float2 p)
{
    float2 i = floor(p);
    float2 f = frac(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = VoxelCloudHash(i);
    float b = VoxelCloudHash(i + float2(1, 0));
    float c = VoxelCloudHash(i + float2(0, 1));
    float d = VoxelCloudHash(i + float2(1, 1));
    return lerp(lerp(a, b, f.x), lerp(c, d, f.x), f.y);
}

// Cloud density (0..1) at a world XZ position on the cloud layer.
float VoxelCloudDensity(float2 xz)
{
    float coverage = _VoxelClouds.x;
    if (coverage <= 0.001) return 0;
    float2 p = (xz + _VoxelCloudOffset.xy) * _VoxelClouds.w;
    float n = VoxelCloudNoise(p) * 0.5 + VoxelCloudNoise(p * 2.03 + 17.1) * 0.25
            + VoxelCloudNoise(p * 4.01 + 31.7) * 0.125 + VoxelCloudNoise(p * 8.07 + 7.3) * 0.0625;
    n /= 0.9375;
    float edge = 1.0 - coverage;
    return saturate((n - edge) / max(0.12, coverage * 0.6)) * _VoxelClouds.y;
}

// Fraction of sunlight the clouds let through at a world position (1 = clear).
float VoxelCloudShadow(float3 positionWS)
{
    if (_VoxelCloudOffset.w < 0.5) return 1.0;
    float3 L = _VoxelSunDir.xyz;
    float lift = _VoxelClouds.z - positionWS.y;
    float2 xz = positionWS.xz + L.xz / max(L.y, 0.12) * lift;
    return 1.0 - VoxelCloudDensity(xz) * _VoxelCloudOffset.z;
}

// Rain and snow on a surface. exposure (0..1) is how open it is to the sky (voxel sky light), so caves and the
// ground under trees stay dry; top marks upward block faces, where snow settles and puddles form.
// snowAlbedo is the snow layer's colour, sampled by the caller (only needed while it snows).
void VoxelWeatherSurface(float3 p, float exposure, bool top, float3 snowAlbedo,
                         inout float3 albedo, inout float roughness, inout float3 normalWS, inout float specular)
{
    float wet = _VoxelWeather.x * exposure;
    float snow = _VoxelWeather.y * exposure;
    if (snow > 0.001)
    {
        float up = saturate(normalWS.y);
        float n = VoxelCloudNoise(p.xz * 0.9 + p.y * 0.37) * 0.6 + VoxelCloudNoise(p.xz * 3.1) * 0.4;
        float cover = smoothstep(0.15, 0.35, up * snow * 1.4 - (1.0 - n) * 0.5 + (top ? 0.25 : -0.2));
        albedo = lerp(albedo, snowAlbedo, cover);
        roughness = lerp(roughness, 0.55, cover);
        specular = lerp(specular, 0.6, cover);
        normalWS = normalize(lerp(normalWS, float3(0, 1, 0), cover * 0.5));
        wet *= 1.0 - cover;
    }
    if (wet > 0.001)
    {
        // water fills pores: darker, glossier
        albedo *= lerp(1.0, 0.62, wet);
        roughness = lerp(roughness, roughness * 0.35, wet);
        specular = lerp(specular, 1.0, wet * 0.5);
        float puddles = _VoxelWeather.z;
        if (top && puddles > 0.001)
        {
            float m = VoxelCloudNoise(p.xz * 0.12) * 0.7 + VoxelCloudNoise(p.xz * 0.6) * 0.3;
            float pud = smoothstep(0.6, 0.68, m + puddles * 0.25) * wet * puddles;
            albedo *= lerp(1.0, 0.55, pud);
            roughness = lerp(roughness, 0.03, pud);
            specular = lerp(specular, 1.0, pud);
            normalWS = normalize(lerp(normalWS, float3(0, 1, 0), pud));
        }
    }
}

// Distance fog (URP's linear fog, as before) plus exponential height fog that pools in valleys and over water,
// tinted toward the sun's colour when looking toward it.
half3 VoxelApplyFog(half3 color, float3 positionWS, float fogFactor)
{
    float3 cam = GetCameraPositionWS();
    float3 d = positionWS - cam;
    float dist = length(d);
    float3 V = d / max(dist, 1e-4);
    float sun = pow(saturate(dot(V, _VoxelSunDir.xyz)), 8.0) * _VoxelFogParams.w;
    half3 fogColor = lerp(unity_FogColor.rgb, _VoxelFogSun.rgb, sun);

    half3 fogged = MixFogColor(color, fogColor, fogFactor);

    float k = max(_VoxelFogParams.y, 1e-4);
    float h0 = cam.y - _VoxelFogParams.x;
    float dy = d.y;
    // integral of density * exp(-k * height) along the ray, divided by its length
    float mean = abs(k * dy) > 1e-3 ? (exp(-k * h0) - exp(-k * (h0 + dy))) / (k * dy) : exp(-k * h0);
    float visibility = exp(-_VoxelFogParams.z * min(mean, 50.0) * dist);
    return lerp(fogColor, fogged, visibility);
}

#endif
