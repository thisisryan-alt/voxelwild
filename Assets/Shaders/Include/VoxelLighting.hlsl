#ifndef VOXELWILD_LIGHTING_INCLUDED
#define VOXELWILD_LIGHTING_INCLUDED

// URP's UniversalFragmentPBR with two voxel-light hooks:
//   skyDirect      scales the main (sun/moon) light by how exposed the surface is to the sky, so cave
//                  interiors beyond shadow-map range never receive sunlight;
//   extraDiffuse   added irradiance (voxel block light) lit through the BRDF's diffuse term;
//   transAlbedo    albedo x translucency of thin surfaces; lit from behind by the main light (reusing its
//                  shadow lookup) for foliage back-lighting;
//   specularScale  per-material reflectance (vegetation scatters rather than mirrors).
// Sky-light scaling of ambient/reflections is done by the caller through surfaceData.occlusion.
#include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

// rgb = block light colour * intensity (EnvironmentLighting)
float4 _VoxelBlockLightColor;

half4 VoxelFragmentPBR(InputData inputData, SurfaceData surfaceData, half skyDirect, half3 extraDiffuse, half3 transAlbedo, half specularScale)
{
    BRDFData brdfData;
    InitializeBRDFData(surfaceData, brdfData);
    // vegetation and other scattering surfaces reflect far less than the dielectric default
    brdfData.specular *= specularScale;
    brdfData.grazingTerm *= specularScale;
    BRDFData brdfDataClearCoat = CreateClearCoatBRDFData(surfaceData, brdfData);
    half4 shadowMask = CalculateShadowMask(inputData);
    AmbientOcclusionFactor aoFactor = CreateAmbientOcclusionFactor(inputData, surfaceData);
    uint meshRenderingLayers = GetMeshRenderingLayer();
    Light mainLight = GetMainLight(inputData, shadowMask, aoFactor);
    mainLight.shadowAttenuation *= skyDirect;
    half3 transmitted = 0;
    if (any(transAlbedo > 0))
    {
        half back = saturate(dot(-inputData.normalWS, mainLight.direction)) * 0.6
                  + pow(saturate(dot(-inputData.viewDirectionWS, mainLight.direction)), 6.0) * 0.8;
        transmitted = transAlbedo * mainLight.color * mainLight.shadowAttenuation * back;
    }

    MixRealtimeAndBakedGI(mainLight, inputData.normalWS, inputData.bakedGI);
    LightingData lightingData = CreateLightingData(inputData, surfaceData);
    lightingData.giColor = GlobalIllumination(brdfData, brdfDataClearCoat, surfaceData.clearCoatMask,
                                              inputData.bakedGI, aoFactor.indirectAmbientOcclusion, inputData.positionWS,
                                              inputData.normalWS, inputData.viewDirectionWS, inputData.normalizedScreenSpaceUV);
#ifdef _LIGHT_LAYERS
    if (IsMatchingLightLayer(mainLight.layerMask, meshRenderingLayers))
#endif
    {
        lightingData.mainLightColor = LightingPhysicallyBased(brdfData, brdfDataClearCoat, mainLight,
                                                              inputData.normalWS, inputData.viewDirectionWS,
                                                              surfaceData.clearCoatMask, false);
    }

#if defined(_ADDITIONAL_LIGHTS)
    uint pixelLightCount = GetAdditionalLightsCount();
    #if USE_CLUSTER_LIGHT_LOOP
    [loop] for (uint lightIndex = 0; lightIndex < min(URP_FP_DIRECTIONAL_LIGHTS_COUNT, MAX_VISIBLE_LIGHTS); lightIndex++)
    {
        CLUSTER_LIGHT_LOOP_SUBTRACTIVE_LIGHT_CHECK
        Light light = GetAdditionalLight(lightIndex, inputData, shadowMask, aoFactor);
    #ifdef _LIGHT_LAYERS
        if (IsMatchingLightLayer(light.layerMask, meshRenderingLayers))
    #endif
            lightingData.additionalLightsColor += LightingPhysicallyBased(brdfData, brdfDataClearCoat, light,
                inputData.normalWS, inputData.viewDirectionWS, surfaceData.clearCoatMask, false);
    }
    #endif
    LIGHT_LOOP_BEGIN(pixelLightCount)
        Light light = GetAdditionalLight(lightIndex, inputData, shadowMask, aoFactor);
    #ifdef _LIGHT_LAYERS
        if (IsMatchingLightLayer(light.layerMask, meshRenderingLayers))
    #endif
            lightingData.additionalLightsColor += LightingPhysicallyBased(brdfData, brdfDataClearCoat, light,
                inputData.normalWS, inputData.viewDirectionWS, surfaceData.clearCoatMask, false);
    LIGHT_LOOP_END
#endif

    lightingData.vertexLightingColor += extraDiffuse * brdfData.diffuse + transmitted;
    return min(CalculateFinalColor(lightingData, surfaceData.alpha), HALF_MAX);
}

// Voxel light curves: ambient/reflections fall off quadratically with sky light (caves go dark);
// direct sun needs a surface that is mostly open to the sky; block light is warm and quadratic.
half VoxelSkyAmbient(half sky) { return lerp(0.015, 1.0, sky * sky); }
half VoxelSkyDirect(half sky) { return smoothstep(0.35, 0.85, sky); }
half3 VoxelBlockIrradiance(half block) { return _VoxelBlockLightColor.rgb * (block * block); }

#endif
