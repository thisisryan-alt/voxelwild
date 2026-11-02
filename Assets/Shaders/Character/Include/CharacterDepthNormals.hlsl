#ifndef VOXELWILD_CHARACTER_DEPTHNORMALS_INCLUDED
#define VOXELWILD_CHARACTER_DEPTHNORMALS_INCLUDED

// Depth + normals (SSAO) for character shaders; geometric normal is enough for the AO pass.
// Define CHAR_ALPHA_CLIP with `half CharAlpha(float2 uv)` and `_Cutoff` to alpha-test.
half4 DepthNormalsFrag(CharVaryings i, bool frontFace : SV_IsFrontFace) : SV_Target
{
#if defined(CHAR_ALPHA_CLIP)
    clip(CharAlpha(i.uv) - _Cutoff);
#endif
    float3 normalWS = normalize(i.normalWS);
    if (!frontFace) normalWS = -normalWS;
#if defined(_GBUFFER_NORMALS_OCT)
    float2 octNormalWS = PackNormalOctQuadEncode(normalWS);
    float2 remapped = saturate(octNormalWS * 0.5 + 0.5);
    return half4(PackFloat2To888(remapped), 0.0);
#else
    return half4(NormalizeNormalPerPixel(normalWS), 0.0);
#endif
}

#endif
