#ifndef VOXELWILD_CHARACTER_HAIR_LIGHTING_INCLUDED
#define VOXELWILD_CHARACTER_HAIR_LIGHTING_INCLUDED

// Strand lighting for Voxelwild/Character/Hair (needs the hair shader's CBUFFER and SampleCard).

half StrandSpecular(half3 T, half3 V, half3 L, half exponent)
{
    half3 H = normalize(L + V);
    half TdotH = dot(T, H);
    half sinTH = sqrt(max(1.0h - TdotH * TdotH, 0.0h));
    half dirAtten = smoothstep(-1.0h, 0.0h, TdotH);
    // normalised so a sharper lobe isn't brighter in total
    return dirAtten * pow(sinTH, exponent) * (exponent + 2.0h) / (2.0h * PI);
}

half3 HairLight(Light light, half3 albedo, half3 T, half3 n, half3 V, half strandId, half directScale)
{
    half3 L = light.direction;
    half NoL = dot(n, L);
    half shadow = light.shadowAttenuation * directScale;
    half diff = saturate(NoL * 0.75h + 0.25h);                          // wrapped: hair scatters light
    half3 t1 = normalize(T + n * _SpecShift1);
    half3 t2 = normalize(T + n * (_SpecShift2 + (strandId - 0.5h) * 0.2h));
    half3 spec = StrandSpecular(t1, V, L, _SpecExp1) * _SpecStrength1
               + StrandSpecular(t2, V, L, _SpecExp2) * _SpecStrength2 * albedo * 2.5h * (0.5h + strandId);
    spec *= saturate(NoL + 0.4h);
    half back = pow(saturate(dot(-V, L)), 4.0h) * _Transmission;          // light through the strands
    return light.color * light.distanceAttenuation * (shadow * (albedo * diff + spec) + albedo * back * lerp(1.0h, shadow, 0.5h));
}

half3 ShadeHair(CharVaryings i, half4 card, bool frontFace)
{
    half rootTip = card.r;
    half strandId = card.g;
    half3 albedo = _HairColor.rgb;
    albedo *= lerp(1.0h - _RootDarken, 1.0h + _TipLighten, rootTip);
    albedo *= lerp(1.0h, 0.6h + 0.8h * strandId, _StrandVariation);

    half3 n = normalize(i.normalWS);
    if (!frontFace) n = -n;
    half3 tWS = normalize(i.tangentWS.xyz);
    half3 strand = normalize(cross(normalize(i.normalWS), tWS) * i.tangentWS.w);   // bitangent = +V = root->tip

    InputData inputData = CharInputData(i, n);
    half3 V = inputData.viewDirectionWS;
    CharVoxelLight vox = GetCharVoxelLight(_VoxelSky, _VoxelBlock);
    half3 color = 0;
    Light mainLight = GetMainLight(inputData.shadowCoord, inputData.positionWS, inputData.shadowMask);
    color += HairLight(mainLight, albedo, strand, n, V, strandId, vox.direct);
    CHAR_ADDITIONAL_LIGHTS(color, HairLight(light, albedo, strand, n, V, strandId, 1.0h))
    half rootOcc = lerp(1.0h - _AOStrength, 1.0h, rootTip);
    color += albedo * (SampleSH(n) * vox.ambient + vox.block) * rootOcc * CharScreenSpaceAO(inputData.normalizedScreenSpaceUV);
    return MixFog(color, inputData.fogCoord);
}

#endif
