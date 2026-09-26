// GLSL ES 3.00 ports of the Unity shaders (VoxelCommon / VoxelTerrainSurface / VoxelLighting / VoxelPasses / VoxelSky /
// VoxelWater / atmosphere), plus the post chain. Terrain and foliage share one source (CUTOUT define).

export const COMMON = /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler2DArray;
precision highp sampler2DShadow;
#define PI 3.14159265
const vec3 FN[8] = vec3[8](vec3(1,0,0), vec3(-1,0,0), vec3(0,1,0), vec3(0,-1,0), vec3(0,0,1), vec3(0,0,-1),
                           vec3(0.7071068,0,-0.7071068), vec3(0.7071068,0,0.7071068));
const vec3 FT[8] = vec3[8](vec3(0,0,1), vec3(0,0,-1), vec3(1,0,0), vec3(-1,0,0), vec3(-1,0,0), vec3(1,0,0),
                           vec3(0.7071068,0,0.7071068), vec3(-0.7071068,0,0.7071068));
const vec3 FB[8] = vec3[8](vec3(0,1,0), vec3(0,1,0), vec3(0,0,1), vec3(0,0,1), vec3(0,1,0), vec3(0,1,0), vec3(0,1,0), vec3(0,1,0));

uniform float uTime;
uniform vec4 uWind;
// per-layer material tuning (renderer.setTuning): x 0 = 1/tile, normal, roughness, macro; 1 = tint rgb, specular;
// 2 = emission, translucency, biome tint, cutout; 3 = relief depth, special (1 starfield, 2 portal), 0, 0
uniform highp sampler2D uTune;
#define TLP(i) texelFetch(uTune, ivec2(0, (i)), 0)
#define TLT(i) texelFetch(uTune, ivec2(1, (i)), 0)
#define TLP2(i) texelFetch(uTune, ivec2(2, (i)), 0)
#define TLP3(i) texelFetch(uTune, ivec2(3, (i)), 0)          // x,z dir, y strength, w gust

// block cell of a cross-plant vertex (mesh.js cross(): corner x 0/1 sit 0.84 blocks apart along the diagonal)
vec3 plantCell(vec3 texPos, int face, vec2 corner) {
  vec3 c = texPos + FT[face] * ((0.5 - corner.x) * 1.188);
  c.y = texPos.y - corner.y * 0.5 + 0.01;
  return floor(c);
}
float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
}
vec3 windOffset(vec3 p, float w) {
  if (w <= 0.0) return vec3(0);
  float t = uTime, phase = dot(p.xz, vec2(0.37, 0.29));
  float gust = 0.6 + 0.4 * sin(t * 0.37 + p.x * 0.02) * uWind.w;
  float sway = sin(t * 1.9 + phase) * 0.6 + sin(t * 3.3 + phase * 1.7) * 0.25;
  float s = uWind.y * w * gust;
  return vec3(uWind.x, 0.0, uWind.z) * (sway + 0.6) * s + vec3(0, -abs(sway) * s * 0.15, 0);
}
`;

// ------------------------------------------------------------------ lighting shared by terrain, foliage, water, entities
export const LIGHTING = /* glsl */ `
uniform vec3 uCamPos;
uniform vec3 uLightDir;       // toward the sun (or moon at night)
uniform vec3 uLightColor;
uniform vec3 uAmbUp, uAmbHorizon, uAmbDown;
uniform vec3 uFogColor, uFogSun;
uniform vec4 uFog;            // density, falloff, base height, start
uniform vec2 uFogEdge;        // edge fade start, end (m)
uniform vec3 uBlockColor;
uniform float uCamSky;        // 0 underground .. 1
uniform mat4 uShadowVP[2];
uniform sampler2DShadow uShadow0, uShadow1;
uniform vec2 uShadowDist;     // cascade far distances
uniform float uShadowSize;
uniform float uShadowOn;
uniform sampler2D uCloudTex;
uniform vec4 uCloud;          // coverage, 1/size, height, shadow strength
uniform vec4 uCloudOff;       // offset xy, sharpness, brightness
uniform float uWet, uSnow;    // weather: ground wetness 0..1, snow cover 0..1
uniform sampler2D uSkyLut;
uniform vec3 uDimAmb;         // ambient light independent of the sky (the Nether, the End)
uniform float uDim;           // 0 overworld, 1 nether, 2 end

float cloudDensity(vec2 xz, float lod) {
  vec2 uv = (xz + uCloudOff.xy) * uCloud.y;
  float n = textureLod(uCloudTex, uv, lod).r * 0.78 + textureLod(uCloudTex, uv * 3.7 + 0.31, lod).g * 0.22;
  return clamp((n - (1.0 - uCloud.x)) * uCloudOff.z, 0.0, 1.0);
}
float cloudShadow(vec3 p) {
  if (uCloud.w <= 0.0 || uLightDir.y < 0.03) return 1.0;
  vec2 xz = p.xz + uLightDir.xz * ((uCloud.z - p.y) / uLightDir.y);
  return 1.0 - cloudDensity(xz, 3.0) * uCloud.w;
}
float shadowAt(vec3 p, vec3 n) {
  if (uShadowOn < 0.5) return 1.0;
  float d = distance(p, uCamPos);
  int c = d < uShadowDist.x ? 0 : 1;
  if (d > uShadowDist.y) return 1.0;
  float texel = c == 0 ? uShadowDist.x * 2.0 / uShadowSize : uShadowDist.y * 2.0 / uShadowSize;
  vec3 pb = p + n * texel * 1.5 + uLightDir * texel * 1.0;
  vec4 s = uShadowVP[c] * vec4(pb, 1.0);
  vec3 q = s.xyz / s.w * 0.5 + 0.5;
  if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0 || q.z > 1.0) return 1.0;
  float o = 1.0 / uShadowSize;
  float sum;
  if (c == 0) sum = texture(uShadow0, q + vec3(-o, -o, 0)) + texture(uShadow0, q + vec3(o, -o, 0)) + texture(uShadow0, q + vec3(-o, o, 0)) + texture(uShadow0, q + vec3(o, o, 0));
  else sum = texture(uShadow1, q + vec3(-o, -o, 0)) + texture(uShadow1, q + vec3(o, -o, 0)) + texture(uShadow1, q + vec3(-o, o, 0)) + texture(uShadow1, q + vec3(o, o, 0));
  float fade = smoothstep(uShadowDist.y * 0.85, uShadowDist.y, d);
  return mix(sum * 0.25, 1.0, fade);
}
vec3 hemi(vec3 n) { return n.y >= 0.0 ? mix(uAmbHorizon, uAmbUp, n.y) : mix(uAmbHorizon, uAmbDown, -n.y); }
float phaseHG(float mu, float g) { float g2 = g * g; return (1.0 - g2) / (4.0 * PI * pow(max(1.0 + g2 - 2.0 * g * mu, 1e-4), 1.5)); }

vec3 applyFog(vec3 col, vec3 p) {
  vec3 ray = p - uCamPos; float dist = length(ray); vec3 dir = ray / max(dist, 1e-4);
  float start = uFog.w, b = uFog.y;
  float dd = max(dist - start, 0.0);
  vec3 p0 = uCamPos + dir * start;
  float dy = dir.y * dd;
  float base = uFog.x * exp(-b * (p0.y - uFog.z));
  float k = abs(b * dy) > 1e-4 ? (1.0 - exp(-b * dy)) / (b * dy) : 1.0;
  float fog = 1.0 - exp(-base * k * dd);
  vec3 fc = uFogColor + uFogSun * 0.25 * phaseHG(dot(dir, uLightDir), 0.72) * 4.0 * PI;
  fc *= mix(0.04, 1.0, uCamSky);
  col = mix(col, fc, fog);
  // the end of the loaded world dissolves into the sky behind it
  float edge = smoothstep(uFogEdge.x, uFogEdge.y, length(ray.xz));
  if (edge > 0.0) {
    vec3 d2 = dir;
    vec3 skyc = textureLod(uSkyLut, vec2(atan(d2.z, d2.x) / (2.0 * PI) + 0.5, asin(d2.y) / PI + 0.5), 0.0).rgb * mix(0.04, 1.0, uCamSky);
    col = mix(col, skyc, edge);
  }
  return col;
}

// URP-style PBR with voxel hooks: sky light gates ambient/reflections and the sun; block light is warm irradiance.
vec3 shade(vec3 albedo, vec3 n, float rough, float metal, float ao, float spec, vec3 emission, float trans,
           vec3 p, float sky, float blk, float directShade, sampler2D skyLut) {
  vec3 V = normalize(uCamPos - p);
  vec3 L = uLightDir;
  float skyAmb = mix(0.015, 1.0, sky * sky);
  float skyDir = smoothstep(0.35, 0.85, sky);
  float sh = shadowAt(p, n) * cloudShadow(p) * skyDir;
  float ndl = max(dot(n, L), 0.0);
  vec3 diff = albedo * (1.0 - metal);
  vec3 F0 = mix(vec3(0.04 * spec), albedo, metal);
  vec3 H = normalize(L + V);
  float a = max(rough * rough, 0.02), a2 = a * a;
  float nh = max(dot(n, H), 0.0), nv = max(dot(n, V), 1e-3);
  float dg = nh * nh * (a2 - 1.0) + 1.0;
  float D = a2 / (PI * dg * dg);
  float k = (a + 1.0) * (a + 1.0) / 8.0;
  float G = (ndl / (ndl * (1.0 - k) + k)) * (nv / (nv * (1.0 - k) + k));
  vec3 Fs = F0 + (1.0 - F0) * pow(1.0 - max(dot(H, V), 0.0), 5.0);
  vec3 specular = D * G * Fs / max(4.0 * ndl * nv, 1e-3) * ndl;
  vec3 direct = (diff * ndl * directShade + specular) * uLightColor * sh;
  vec3 ambient = diff * (hemi(n) * skyAmb + uDimAmb) * ao;
  vec3 R = reflect(-V, n);
  vec2 luv = vec2(atan(R.z, R.x) / (2.0 * PI) + 0.5, asin(clamp(R.y, -1.0, 1.0)) / PI + 0.5);
  vec3 env = textureLod(skyLut, luv, rough * 5.0).rgb;
  vec3 Fr = F0 + (max(vec3(1.0 - rough), F0) - F0) * pow(1.0 - nv, 5.0);
  vec3 refl = env * Fr * skyAmb * ao * (1.0 - rough * 0.7);
  vec3 blockL = diff * uBlockColor * (blk * blk) * ao;
  vec3 transmitted = vec3(0);
  if (trans > 0.0) {
    float back = max(dot(-n, L), 0.0) * 0.6 + pow(max(dot(-V, L), 0.0), 6.0) * 0.8;
    transmitted = albedo * trans * uLightColor * sh * back;
  }
  return direct + ambient + refl + blockL + emission + transmitted;
}
`;

// ------------------------------------------------------------------ texture variants
// A row per layer (+ virtual rows) of 34 texels: 0..31 texture layers to pick from, 32 = (mode, w, h, flags),
// 33 = (side-overlay row). Mode 0: the layer itself; 1: random per block (weighted slots) with optional quarter
// turns on top/bottom faces and mirroring; 2: OptiFine-style repeat, a w x h grid of tiles spread over the blocks.
export const VARIANTS = /* glsl */ `
precision highp usampler2D;
uniform usampler2D uVar;
uint vhash(ivec3 c) {
  uint h = (uint(c.x) * 73856093u) ^ (uint(c.y) * 19349663u) ^ (uint(c.z) * 83492791u);
  h = (h ^ (h >> 13u)) * 0x5bd1e995u;
  return h ^ (h >> 15u);
}
vec2 rot90(vec2 d, uint r) { return r == 1u ? vec2(d.y, -d.x) : r == 2u ? -d : r == 3u ? vec2(-d.y, d.x) : d; }
// animation (mode 3): w frames at h/10 frames per second, blended; the second frame and weight go out through these
int gTl2; float gBlend;
int pickLayer(int row, int face, vec3 cell, vec2 uvB, inout vec2 uv, inout vec2 gx, inout vec2 gy) {
  uvec4 inf = texelFetch(uVar, ivec2(32, row), 0);
  gBlend = 0.0;
  if (inf.x == 0u) return int(texelFetch(uVar, ivec2(0, row), 0).r);
  if (inf.x == 3u) {
    float f = uTime * float(inf.z) * 0.1;
    int n = int(inf.y), a = int(mod(floor(f), float(n)));
    gTl2 = int(texelFetch(uVar, ivec2((a + 1) % n, row), 0).r);
    gBlend = fract(f);
    return int(texelFetch(uVar, ivec2(a, row), 0).r);
  }
  if (inf.x == 4u) {
    // height bands (OptiFine method=fixed with min/maxHeight): slot k+1 = (texture, minY, maxY, face mask)
    int y = int(cell.y);
    uint fm = face == 2 ? 2u : face == 3 ? 4u : 1u;
    for (int k = 0; k < int(inf.y); k++) {
      uvec4 b = texelFetch(uVar, ivec2(k + 1, row), 0);
      if (y >= int(b.g) && y <= int(b.b) && (b.a & fm) != 0u) return int(b.r);
    }
    return int(texelFetch(uVar, ivec2(0, row), 0).r);
  }
  if (inf.x == 2u) {
    ivec2 t = ivec2(floor(uvB + 1e-4)); int w = int(inf.y), h = int(inf.z);
    return int(texelFetch(uVar, ivec2(((t.x % w) + w) % w + (((t.y % h) + h) % h) * w, row), 0).r);
  }
  uint hs = vhash(ivec3(cell) + ivec3(row * 7, 0, 0));
  vec2 c = floor(uv) + 0.5, d = uv - c;
  if ((inf.w & 1u) != 0u && (face == 2 || face == 3)) {
    uint r = (hs >> 5u) & 3u;
    d = rot90(d, r); gx = rot90(gx, r); gy = rot90(gy, r);
  }
  if ((inf.w & 2u) != 0u && ((hs >> 7u) & 1u) != 0u && face != 2 && face != 3) { d.x = -d.x; gx.x = -gx.x; gy.x = -gy.x; }
  uv = c + d;
  return int(texelFetch(uVar, ivec2(int(hs & 31u), row), 0).r);
}
int sideRow(int layer) { return int(texelFetch(uVar, ivec2(33, layer), 0).r); }
`;

// ------------------------------------------------------------------ terrain / foliage / entities
export const TERRAIN_VS = /* glsl */ `
layout(location=0) in vec3 aPos;
layout(location=1) in vec4 aD0;
layout(location=2) in vec4 aD1;
layout(location=3) in vec4 aD2;
uniform mat4 uViewProj;
uniform mat4 uModel;          // section: translation; entity: translation * rotation * scale
uniform vec3 uTexOrigin;      // world-continuous UVs for sections, object-local for entities
uniform vec2 uEntityLight;    // entities: sky, block light (x < 0: use the vertex light)
out vec3 vPos;
out vec3 vTexPos;
flat out ivec4 vFace;         // face, edges, layer, overlay
out vec3 vLight;              // ao, sky, block
flat out vec4 vClim;          // temperature, humidity, tint mode
out vec2 vCorner;
flat out vec3 vCell;          // block of a cross plant (variant pick)
void main() {
  uvec4 a = uvec4(round(aD0 * 255.0));
  uvec4 c = uvec4(round(aD2 * 255.0));
  vec3 p = (uModel * vec4(aPos, 1.0)).xyz;
#ifdef CUTOUT
  p += windOffset(p, aD2.y);
#endif
  vPos = p;
  vTexPos = aPos + uTexOrigin;
  vFace = ivec4(int(a.x & 7u), int((a.x >> 3u) & 15u), int(a.y), int(a.w));
  vLight = uEntityLight.x < 0.0 ? vec3(aD0.z, aD1.x, aD1.y) : vec3(aD0.z, uEntityLight);
  vClim = vec4(aD1.z, aD1.w, float(c.x), 0.0);
  vCorner = vec2(float((a.x >> 3u) & 1u), float((a.x >> 4u) & 1u));
  vCell = plantCell(vTexPos, vFace.x, vCorner);
  gl_Position = uViewProj * vec4(p, 1.0);
}
`;

export const TERRAIN_FS = VARIANTS + /* glsl */ `
uniform sampler2DArray uAlbedo, uNormal, uMask;
uniform float uPom, uPomDist;   // relief multiplier (0 = off), fade-out distance
uniform mat3 uModelRot;
uniform float uBevelWidth, uBevelStrength, uEdgeWear, uAOStrength, uAODirect, uOverhang, uCutoff;
uniform float uFlash;     // lightning
uniform sampler2D uStars;  // end portal starfield
uniform int uDebug;       // 0 lit, 1 albedo, 2 normal, 3 ao/rough/metal, 4 vertex light, 5 uv/layer
in vec3 vPos;
in vec3 vTexPos;
flat in ivec4 vFace;
in vec3 vLight;
flat in vec4 vClim;
in vec2 vCorner;
flat in vec3 vCell;
out vec4 outColor;

vec3 biomeTint(int mode, float t, float h) {
  if (mode == 0) return vec3(1);
  if (mode == 3) return vec3(1.18, 1.16, 0.78);
  if (mode == 4) return vec3(0.86, 0.96, 0.92);
  vec3 cd, cw, hd, hw;
  if (mode == 1) { cd = vec3(0.86, 0.94, 0.86); cw = vec3(0.72, 0.9, 0.82); hd = vec3(1.2, 1.03, 0.62); hw = vec3(0.78, 1.08, 0.66); }
  else { cd = vec3(0.9, 0.95, 0.85); cw = vec3(0.74, 0.88, 0.8); hd = vec3(1.2, 1.05, 0.6); hw = vec3(0.72, 1.1, 0.6); }
  vec3 c = mix(mix(cd, hd, t), mix(cw, hw, t), h);
  vec3 tint = mix(vec3(1), c, clamp(length(vec2(t, h) - 0.5) * 2.2, 0.0, 1.0));
  float swamp = smoothstep(0.66, 0.8, h) * smoothstep(0.35, 0.45, t) * (1.0 - smoothstep(0.62, 0.7, t));
  return mix(tint, vec3(0.74, 0.8, 0.56), swamp * 0.8);
}

struct Layer { vec3 albedo; float alpha; vec3 nts; float ao; float rough; float metal; float emis; };
Layer sampleLayer(int layer, int tl, vec2 uv, vec2 gx, vec2 gy) {
  vec4 a = textureGrad(uAlbedo, vec3(uv, float(tl)), gx, gy);
  vec4 n = textureGrad(uNormal, vec3(uv, float(tl)), gx, gy);
  vec4 m = textureGrad(uMask, vec3(uv, float(tl)), gx, gy);
  Layer s;
  s.albedo = pow(a.rgb, vec3(2.2)) * TLT(layer).rgb;
  if (TLP2(layer).z > 0.5) s.albedo *= biomeTint(int(vClim.z + 0.5), vClim.x, vClim.y);
  s.alpha = a.a;
  s.nts = n.xyz * 2.0 - 1.0; s.nts.xy *= TLP(layer).y; s.nts = normalize(s.nts);
  s.ao = m.r; s.rough = clamp(m.g * TLP(layer).z, 0.0, 1.0); s.metal = m.b; s.emis = m.a * TLP2(layer).x;
  return s;
}

void main() {
  int face = vFace.x, edges = vFace.y, layer = vFace.z, overlay = vFace.w;
  vec3 N = FN[face], T = FT[face], B = FB[face];
  bool plant = face >= 6;
  // image rows run top-down, so v is flipped against the up axis
  vec2 uvBlocks = vec2(dot(vTexPos, T), -dot(vTexPos, B));
  vec2 uv = plant ? vec2(vCorner.x, 1.0 - vCorner.y) : uvBlocks * TLP(layer).x;
  vec3 cell = floor(vTexPos - N * 0.5);
  vec3 local = vTexPos - cell;
  float u = dot(local - 0.5, T) + 0.5, w = dot(local - 0.5, B) + 0.5;

  vec2 gx = dFdx(uv), gy = dFdy(uv);
  vec2 ogx = dFdx(uvBlocks), ogy = dFdy(uvBlocks);
  vec3 block = plant ? vCell : cell;
  vec2 uvB0 = uvBlocks;
  int tl = pickLayer(layer, face, block, uvBlocks, uv, gx, gy);
  float pomShadow = 1.0;
#ifndef CUTOUT
  // parallax occlusion mapping: march the view ray through the height field (albedo alpha, 1 = surface)
  float vdist = distance(uCamPos, vPos);
  float depthBlocks = TLP3(layer).x * uPom;
  if (!plant && depthBlocks > 0.0 && vdist < uPomDist && TLP2(layer).w < 0.5) {
    vec3 V = normalize(uCamPos - vPos);
    vec3 Nw = normalize(uModelRot * N), Tw = normalize(uModelRot * T), Bw = normalize(uModelRot * B);
    float ndv = max(dot(V, Nw), 0.02);
    float fade = 1.0 - smoothstep(uPomDist * 0.6, uPomDist, vdist);
    float k = TLP(layer).x * depthBlocks * fade;
    vec2 dir = vec2(-dot(V, Tw), dot(V, Bw)) / max(ndv, 0.2) * k;
    int steps = int(mix(40.0, 10.0, ndv));
    float stepD = 1.0 / float(steps);
    float L = float(tl);
    vec2 cur = uv, prevUV = uv;
    float depth = 0.0, prevDepth = 0.0;
    float h = textureGrad(uAlbedo, vec3(cur, L), gx, gy).a, prevH = h;
    for (int i = 0; i < 40; i++) {
      if (i >= steps || depth >= 1.0 - h) break;
      prevUV = cur; prevH = h; prevDepth = depth;
      cur += dir * stepD; depth += stepD;
      h = textureGrad(uAlbedo, vec3(cur, L), gx, gy).a;
    }
    float after = (1.0 - h) - depth, before = (1.0 - prevH) - prevDepth;
    float wgt = clamp(after / (after - before - 1e-5), 0.0, 1.0);
    cur = mix(cur, prevUV, wgt);
    float d0 = mix(depth, prevDepth, wgt);
    // soft self-shadowing: does the height field rise above the ray toward the sun?
    float ndl = dot(uLightDir, Nw);
    if (ndl > 0.02 && d0 > 0.01 && vdist < uPomDist * 0.7) {
      vec2 ldir = vec2(dot(uLightDir, Tw), -dot(uLightDir, Bw)) / max(ndl, 0.2) * k;
      float occ = 0.0;
      for (int j = 1; j <= 10; j++) {
        float t = float(j) / 10.0;
        float dj = d0 * (1.0 - t);
        float hj = textureGrad(uAlbedo, vec3(cur + ldir * (d0 - dj), L), gx, gy).a;
        occ = max(occ, (hj - (1.0 - dj)) * 6.0 * (1.0 - t));
      }
      pomShadow = 1.0 - clamp(occ, 0.0, 1.0) * fade * 0.85;
    }
    uvBlocks += (cur - uv) / TLP(layer).x;
    uv = cur;
  }
#endif
  Layer s = sampleLayer(layer, tl, uv, gx, gy);
  if (gBlend > 0.0) {
    Layer s2 = sampleLayer(layer, gTl2, uv, gx, gy);
    s.albedo = mix(s.albedo, s2.albedo, gBlend); s.alpha = mix(s.alpha, s2.alpha, gBlend); s.emis = mix(s.emis, s2.emis, gBlend);
    s.nts = normalize(mix(s.nts, s2.nts, gBlend));
  }
  float special = TLP3(layer).y;
  if (special > 0.5 && special < 1.5) {
    // end portal / gateway: layers of stars drifting at different depths behind the surface (Minecraft's end portal)
    vec3 V = normalize(vPos - uCamPos);
    vec3 acc = vec3(0.012, 0.02, 0.03);
    for (int i = 0; i < 7; i++) {
      float fi = float(i + 1), depth = 0.6 + fi * 0.9;
      vec3 q = vPos + V * depth;
      float a = fi * 1.93 + uTime * 0.01 * fi;
      vec2 st = mat2(cos(a), -sin(a), sin(a), cos(a)) * (q.xz + q.y * vec2(0.7, -0.4)) * (0.07 + 0.035 * fi) + vec2(uTime * 0.004 * fi, 0.0);
      float t = texture(uStars, st).r;
      float star = pow(clamp((t - 0.13) * 3.2, 0.0, 1.0), 2.0);   // only the bright specks
      vec3 tintc = 0.5 + 0.5 * cos(vec3(0.0, 2.1, 4.2) + fi * 1.7);
      acc += star * tintc * (1.1 / fi);
    }
    vec3 colS = acc * 1.3;
    outColor = vec4(applyFog(colS, vPos), 1.0);
    return;
  }
  float alpha = TLP2(layer).w > 0.5 ? s.alpha : 1.0;
#ifdef TRANSLUCENT
  // nether portal: glowing, see-through, gently swirling
  vec3 pc = s.albedo * (0.5 + TLP2(layer).x * 0.3);
  pc *= 0.8 + 0.4 * vnoise(vTexPos.xy * 3.0 + vTexPos.zy * 3.0 + uTime * 0.6);
  outColor = vec4(applyFog(pc, vPos), clamp(s.alpha * 0.62, 0.0, 0.75));
  return;
#endif
#ifdef CUTOUT
  // keep foliage coverage in distant mips
  float lod = max(0.0, log2(max(length(dFdx(uv)), length(dFdy(uv))) * 256.0));
  if (alpha * (1.0 + lod * 0.18) < uCutoff) discard;
#endif
  int side = overlay != 255 ? sideRow(overlay) : 255;
  if (side != 255) {
    // Minecraft-style side overlay (resource packs): a fringe texture with alpha over the side of the block
    vec2 ouv = uvB0, ogx2 = ogx, ogy2 = ogy;
    int otl = pickLayer(side, face, block, uvB0, ouv, ogx2, ogy2);
    Layer o = sampleLayer(overlay, otl, ouv, ogx2, ogy2);
    s.albedo = mix(s.albedo, o.albedo, o.alpha);
    s.nts = normalize(mix(s.nts, o.nts, o.alpha));
    s.ao = mix(s.ao, o.ao, o.alpha);
    s.rough = mix(s.rough, o.rough, o.alpha);
  } else if (overlay != 255) {
    Layer o = sampleLayer(overlay, overlay, uvBlocks * TLP(overlay).x, ogx * TLP(overlay).x, ogy * TLP(overlay).x);
    float jitter = hash21(cell.xz + cell.y * 17.0) - 0.5;
    float edge = 1.0 - uOverhang + (o.alpha - 0.5) * 0.28 + jitter * 0.06;
    float m = smoothstep(edge - 0.035, edge + 0.035, w);
    float band = smoothstep(edge - 0.22, edge, w) * (1.0 - m);
    s.albedo = mix(s.albedo * (1.0 - 0.3 * band), o.albedo, m);
    s.nts = normalize(mix(s.nts, o.nts, m));
    s.ao = mix(s.ao * (1.0 - 0.35 * band), o.ao, m);
    s.rough = mix(s.rough, o.rough, m);
  }
  float macroAmt = TLP(layer).w;
  vec2 mp = vTexPos.xz + vTexPos.y * vec2(0.37, -0.21);
  float macro = vnoise(mp * 0.035) * 0.65 + vnoise(mp * 0.11 + 13.1) * 0.35;
  s.albedo *= mix(1.0, 0.8 + 0.4 * macro, macroAmt);

  vec3 n = normalize(T * s.nts.x + B * s.nts.y + N * s.nts.z);
  float edgeAmt = 0.0, fade = 0.0;
  if (!plant) {
    float bw = uBevelWidth;
    float px = max(max(fwidth(u), fwidth(w)), 1e-5);
    fade = clamp(bw / px * 0.5 - 0.5, 0.0, 1.0);
    vec3 tilt = vec3(0); float t;
    t = (edges & 1) != 0 ? clamp(1.0 - u / bw, 0.0, 1.0) : 0.0; tilt -= T * t; edgeAmt = max(edgeAmt, t);
    t = (edges & 2) != 0 ? clamp(1.0 - (1.0 - u) / bw, 0.0, 1.0) : 0.0; tilt += T * t; edgeAmt = max(edgeAmt, t);
    t = (edges & 4) != 0 ? clamp(1.0 - w / bw, 0.0, 1.0) : 0.0; tilt -= B * t; edgeAmt = max(edgeAmt, t);
    t = (edges & 8) != 0 ? clamp(1.0 - (1.0 - w) / bw, 0.0, 1.0) : 0.0; tilt += B * t; edgeAmt = max(edgeAmt, t);
    n = normalize(n + tilt * uBevelStrength * fade * 1.3);
  }
  n = normalize(uModelRot * n);
#ifdef CUTOUT
  if (!gl_FrontFacing) n = -n;
  // foliage: normals lean up and out so a canopy shades as one soft, rounded mass
  if (TLP2(layer).z > 0.5) n = normalize(mix(n, vec3(0.0, 1.0, 0.0), 0.45));
#endif
  float wear = edgeAmt * edgeAmt * uEdgeWear * fade;
  s.albedo = mix(s.albedo, s.albedo * 1.3 + 0.02, wear);
  s.rough = mix(s.rough, clamp(s.rough + 0.2, 0.0, 1.0), wear);

  // weather: wet ground darkens and turns glossy; snow settles on up-facing open surfaces
  float up = clamp(n.y, 0.0, 1.0) * smoothstep(0.6, 0.9, vLight.y);
  if (uWet > 0.0) { float wv = uWet * smoothstep(0.55, 0.95, vLight.y); s.albedo *= mix(1.0, 0.62, wv); s.rough = mix(s.rough, s.rough * 0.35, wv * (0.5 + 0.5 * up)); }
  if (uSnow > 0.0 && !plant) { float sn = smoothstep(0.35, 0.8, up * uSnow + (vnoise(vTexPos.xz * 0.7) - 0.5) * 0.25); s.albedo = mix(s.albedo, vec3(0.86, 0.9, 0.95), sn); s.rough = mix(s.rough, 0.75, sn); }

  float vao = mix(0.28, 1.0, smoothstep(0.0, 1.0, vLight.x));
  vao = mix(1.0, vao, uAOStrength);
  float directShade = mix(1.0, vao, uAODirect);
  vec3 col = shade(s.albedo * directShade, n, s.rough, s.metal, s.ao * vao, TLT(layer).w, s.albedo * s.emis,
                   TLP2(layer).y, vPos, vLight.y, vLight.z, pomShadow, uSkyLut);
  col += s.albedo * uFlash * vLight.y * 2.0;
  outColor = vec4(applyFog(col, vPos), 1.0);
  if (uDebug == 1) outColor = vec4(s.albedo, 1.0);
  else if (uDebug == 2) outColor = vec4(n * 0.5 + 0.5, 1.0);
  else if (uDebug == 3) outColor = vec4(s.ao, s.rough, s.metal, 1.0);
  else if (uDebug == 4) outColor = vec4(vLight, 1.0);
  else if (uDebug == 5) outColor = vec4(uv.x - floor(uv.x), uv.y - floor(uv.y), float(layer) / 80.0, 1.0);
}
`;

export const SHADOW_VS = /* glsl */ `
layout(location=0) in vec3 aPos;
layout(location=1) in vec4 aD0;
layout(location=3) in vec4 aD2;
uniform mat4 uViewProj;
uniform mat4 uModel;
uniform vec3 uTexOrigin;
uniform vec3 uCamPos;
out vec3 vTexPos;
flat out ivec2 vFL;
out vec2 vCorner;
flat out vec3 vCell;
void main() {
  uvec4 a = uvec4(round(aD0 * 255.0));
  vec3 p = (uModel * vec4(aPos, 1.0)).xyz;
  int face = int(a.x & 7u);
#ifdef CUTOUT
  p += windOffset(p, aD2.y);
#endif
  vTexPos = aPos + uTexOrigin;
  vFL = ivec2(face, int(a.y));
  vCorner = vec2(float((a.x >> 3u) & 1u), float((a.x >> 4u) & 1u));
  vCell = plantCell(vTexPos, face, vCorner);
  gl_Position = uViewProj * vec4(p, 1.0);
#ifdef CUTOUT
  // small plants cast shadows only near the camera; leaves out to the mid distance
  if (distance(p, uCamPos) > (face >= 6 ? 24.0 : 64.0)) gl_Position = vec4(0, 0, -2, 1);
#endif
}
`;
export const SHADOW_FS = VARIANTS + /* glsl */ `
uniform sampler2DArray uAlbedo;
uniform float uCutoff;
in vec3 vTexPos;
flat in ivec2 vFL;
in vec2 vCorner;
flat in vec3 vCell;
out vec4 outColor;
void main() {
#ifdef CUTOUT
  int face = vFL.x, layer = vFL.y;
  vec2 uvB = vec2(dot(vTexPos, FT[face]), -dot(vTexPos, FB[face]));
  vec2 uv = face >= 6 ? vec2(vCorner.x, 1.0 - vCorner.y) : uvB * TLP(layer).x;
  vec2 gx = dFdx(uv), gy = dFdy(uv);
  int tl = pickLayer(layer, face, face >= 6 ? vCell : floor(vTexPos - FN[face] * 0.5), uvB, uv, gx, gy);
  if (textureGrad(uAlbedo, vec3(uv, float(tl)), gx, gy).a < uCutoff) discard;
#endif
  outColor = vec4(1);
}
`;

// ------------------------------------------------------------------ sky
export const SKYMODEL = /* glsl */ `
const float R0 = 6360e3, RA = 6420e3, HR = 8000.0, HM = 1200.0;
const vec3 BR = vec3(5.802e-6, 13.558e-6, 33.1e-6);
const float MIE_S = 3.996e-6, MIE_E = 4.4e-6, MIE_G = 0.8, SUN_I = 20.0, SKY_EXP = 0.4;
vec2 raySphere(vec3 o, vec3 d, float r) { float b = dot(o, d), c = dot(o, o) - r * r, disc = b * b - c; if (disc < 0.0) return vec2(-1); float s = sqrt(disc); return vec2(-b - s, -b + s); }
vec2 lightDepth(vec3 p, vec3 d) {
  if (raySphere(p, d, R0).x > 0.0) return vec2(-1);
  float t = raySphere(p, d, RA).y, ds = t / 4.0; vec2 od = vec2(0);
  for (int i = 0; i < 4; i++) { float h = length(p + d * (ds * (float(i) + 0.5))) - R0; od += vec2(exp(-h / HR), exp(-h / HM)) * ds; }
  return od;
}
vec3 scattering(vec3 V, vec3 L, float alt) {
  vec3 o = vec3(0, R0 + alt, 0);
  float tMax = raySphere(o, V, RA).y; vec2 g = raySphere(o, V, R0); if (g.x > 0.0) tMax = g.x;
  float ds = tMax / 12.0; vec2 odv = vec2(0); vec3 sR = vec3(0), sM = vec3(0);
  for (int i = 0; i < 12; i++) {
    vec3 p = o + V * (ds * (float(i) + 0.5)); float h = length(p) - R0;
    vec2 d = vec2(exp(-h / HR), exp(-h / HM)) * ds; odv += d;
    vec2 ol = lightDepth(p, L); if (ol.x < 0.0) continue;
    vec3 att = exp(-(BR * (odv.x + ol.x) + MIE_E * (odv.y + ol.y)));
    sR += d.x * att; sM += d.y * att;
  }
  float mu = dot(V, L), pR = 3.0 / (16.0 * PI) * (1.0 + mu * mu), g2 = MIE_G * MIE_G;
  float pM = 3.0 / (8.0 * PI) * ((1.0 - g2) * (1.0 + mu * mu)) / ((2.0 + g2) * pow(max(1.0 + g2 - 2.0 * MIE_G * mu, 1e-4), 1.5));
  return SKY_EXP * SUN_I * (sR * BR * pR + sM * MIE_S * pM);
}
vec3 sunTrans(vec3 L, float alt) { vec2 od = lightDepth(vec3(0, R0 + alt, 0), L); if (od.x < 0.0) return vec3(0); return exp(-(BR * od.x + MIE_E * od.y)); }
`;

export const FULLSCREEN_VS = /* glsl */ `
out vec2 vUV;
void main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); vUV = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }
`;

// equirectangular scattering, rebuilt when the sun moves (sky pass + reflections sample it)
export const SKYLUT_FS = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uNight;
uniform float uCloudGrey;
uniform float uDim;
uniform vec3 uDimColor;
in vec2 vUV;
out vec4 outColor;
void main() {
  float az = (vUV.x - 0.5) * 2.0 * PI, el = (vUV.y - 0.5) * PI;
  if (uDim > 0.5) { outColor = vec4(uDimColor * (uDim > 1.5 ? 0.6 + 0.6 * clamp(sin(el) + 0.3, 0.0, 1.0) : 1.0), 1.0); return; }
  vec3 V = vec3(cos(el) * cos(az), sin(el), cos(el) * sin(az));
  // single scattering alone turns the last few degrees above the horizon khaki (no multiple scattering); look it up
  // a little higher so the horizon stays a pale, hazy blue
  vec3 Vs = normalize(vec3(V.x, max(V.y, 0.0) * 0.93 + 0.07, V.z));
  vec3 c = scattering(Vs, uSunDir, 150.0);
  if (V.y < 0.0) c *= mix(1.0, 0.6, clamp(-V.y * 3.0, 0.0, 1.0));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(c, vec3(l), uCloudGrey) * (1.0 - uCloudGrey * 0.3);
  c += uNight * (0.35 + 0.65 * clamp(V.y + 0.1, 0.0, 1.0));
  outColor = vec4(c, 1.0);
}
`;

export const SKY_FS = /* glsl */ `
uniform sampler2D uSkyLut;
uniform mat4 uInvViewProj;
uniform vec3 uCamPos;
uniform vec3 uSunDir, uMoonDir;
uniform vec4 uSunParams;     // visibility, moon illumination, star brightness, star rotation
uniform vec3 uSunColorC, uZenith;
uniform sampler2D uCloudTex;
uniform vec4 uCloud, uCloudOff;
uniform float uFlash;
uniform sampler2D uMoonTex;
uniform float uMoonTexOn;
uniform float uDim;
in vec2 vUV;
out vec4 outColor;
float h31(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
vec3 stars(vec3 V) {
  float s = uSunParams.w, cs = cos(s), sn = sin(s);
  vec3 v = vec3(V.x, V.y * 0.766 - V.z * 0.643, V.y * 0.643 + V.z * 0.766);
  v = vec3(v.x * cs - v.z * sn, v.y, v.x * sn + v.z * cs);
  vec3 p = v * 220.0, cell = floor(p);
  float h = h31(cell);
  if (h < 0.965) return vec3(0);
  vec3 c = cell + 0.5 + (vec3(h31(cell + 11.1), h31(cell + 23.7), h31(cell + 5.3)) - 0.5) * 0.6;
  float st = clamp(1.0 - length(p - c) / (0.08 + 0.1 * h31(cell + 3.3)), 0.0, 1.0); st *= st;
  float tw = 0.75 + 0.25 * sin(uTime * (2.0 + 6.0 * h31(cell + 7.7)) + h * 60.0);
  float mag = pow(clamp((h - 0.965) / 0.035, 0.0, 1.0), 3.0);
  return mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.86, 0.7), h31(cell + 9.9)) * st * tw * (0.3 + 4.0 * mag) * uSunParams.z;
}
// a band of faint, patchy light across the sky, turning with the stars
vec3 milkyWay(vec3 V) {
  float s = uSunParams.w, cs = cos(s), sn = sin(s);
  vec3 v = vec3(V.x, V.y * 0.766 - V.z * 0.643, V.y * 0.643 + V.z * 0.766);
  v = vec3(v.x * cs - v.z * sn, v.y, v.x * sn + v.z * cs);
  float band = exp(-pow((v.x * 0.35 + v.y * 0.94) * 3.4, 2.0));
  vec2 p = vec2(atan(v.z, v.x), v.y) * vec2(1.3, 2.2);
  float n = texture(uCloudTex, p * 0.35).r * 0.6 + texture(uCloudTex, p * 1.1 + 0.3).g * 0.4;
  float dustLane = smoothstep(0.35, 0.7, texture(uCloudTex, p * 0.8 + 1.7).r);
  return vec3(0.55, 0.6, 0.85) * band * (0.25 + n) * (1.0 - dustLane * 0.6) * 0.035 * uSunParams.z;
}
float cloudD(vec2 xz) {
  vec2 uv = (xz + uCloudOff.xy) * uCloud.y;
  float n = texture(uCloudTex, uv).r * 0.78 + texture(uCloudTex, uv * 3.7 + 0.31).g * 0.22;
  return clamp((n - (1.0 - uCloud.x)) * uCloudOff.z, 0.0, 1.0);
}
void main() {
  vec4 wp = uInvViewProj * vec4(vUV * 2.0 - 1.0, 1.0, 1.0);
  vec3 V = normalize(wp.xyz / wp.w - uCamPos);
  vec2 luv = vec2(atan(V.z, V.x) / (2.0 * PI) + 0.5, asin(clamp(V.y, -1.0, 1.0)) / PI + 0.5);
  vec3 sky = textureLod(uSkyLut, luv, 0.0).rgb;   // explicit LOD: no mip seam where atan wraps
  if (uDim > 0.5) {
    if (uDim > 1.5) {
      // the End: dark violet murk with slow streaks and faint stars
      vec2 q = V.xz / (abs(V.y) + 0.4);
      float streak = texture(uCloudTex, q * vec2(0.05, 0.16) + uTime * 0.0004).r * texture(uCloudTex, q * 0.11 - uTime * 0.0003).g;
      sky = sky * (0.45 + streak * 1.6) + stars(V) * 0.35;
    }
    outColor = vec4(sky, 1.0);
    return;
  }
  float dayLum = dot(sky, vec3(0.2126, 0.7152, 0.0722));
  if (V.y > 0.0) sky += (stars(V) + milkyWay(V)) * clamp(1.0 - dayLum * 25.0, 0.0, 1.0);
  float r = acos(clamp(dot(V, uSunDir), -1.0, 1.0)) / 0.0125;
  if (r < 1.0 && V.y > -0.02) sky += sunTrans(uSunDir, 150.0) * 900.0 * SKY_EXP * (1.0 - 0.6 * (1.0 - sqrt(max(0.0, 1.0 - r * r)))) * uSunParams.x * smoothstep(1.0, 0.9, r);
  // moon: sphere lit by the sun direction
  vec3 M = uMoonDir;
  if (M.y > -0.02 && dot(V, M) > cos(0.032)) {
    vec3 up = abs(M.y) < 0.99 ? vec3(0, 1, 0) : vec3(1, 0, 0);
    vec3 right = normalize(cross(up, M)); up = cross(M, right);
    vec2 q = vec2(dot(V - M, right), dot(V - M, up)) / 0.028;
    float r2 = dot(q, q);
    if (r2 < 1.0) {
      vec3 nm = normalize(right * q.x + up * q.y - M * sqrt(1.0 - r2));
      float lit = clamp(dot(nm, uSunDir) * 1.5 + 0.05, 0.0, 1.0);
      float maria = 0.75 + 0.25 * sin(q.x * 5.1 + 1.3) * sin(q.y * 4.3 + 0.7);
      if (uMoonTexOn > 0.5) { vec3 mt = texture(uMoonTex, q * vec2(0.5, -0.5) + 0.5).rgb; maria = pow(dot(mt, vec3(0.333)) * 1.45, 2.2); }
      sky = mix(sky, vec3(0.9, 0.92, 0.98) * lit * maria * 0.09 + 0.002, smoothstep(1.0, 0.94, r2) * clamp(1.0 - dayLum * 3.0, 0.0, 1.0));
    }
  }
  // moon halo: a tight corona and a wide, faint glow in the air around it
  float mm = max(dot(V, M), 0.0), dark = clamp(1.0 - dayLum * 12.0, 0.0, 1.0);
  float outside = smoothstep(cos(0.0262), cos(0.0285), mm);
  sky += (pow(mm, 2200.0) * 0.12 * outside + pow(mm, 260.0) * 0.05 + pow(mm, 18.0) * 0.01) * (0.25 + uSunParams.y) * step(-0.02, M.y) * dark * vec3(0.62, 0.72, 1.0);
  // clouds
  if (V.y > 0.01 && uCloud.x > 0.0) {
    float t = (uCloud.z - uCamPos.y) / V.y;
    vec2 xz = uCamPos.xz + V.xz * t;
    float d = cloudD(xz);
    if (d > 0.001) {
      vec3 L = uSunDir.y > -0.05 ? uSunDir : M;
      vec2 toSun = normalize(L.xz + 1e-4) * 180.0 * clamp(1.0 - L.y, 0.0, 1.0);
      float shadeC = exp(-(cloudD(xz + toSun) * 1.6 + cloudD(xz + toSun * 2.2) * 0.9));
      float silver = 1.0 + 1.6 * pow(max(dot(V, L), 0.0), 8.0);
      vec3 col = (uSunColorC * shadeC * silver * 0.9 + uZenith * (0.55 + 0.25 * d)) * uCloudOff.w + uFlash * 2.0;
      float fade = clamp(1.0 - t / 60000.0, 0.0, 1.0) * smoothstep(0.01, 0.08, V.y);
      sky = mix(sky, col, clamp(d * 1.6, 0.0, 1.0) * fade);
    }
  }
  outColor = vec4(sky, 1.0);
}
`;

// ------------------------------------------------------------------ water
export const WATER_FS = /* glsl */ `
uniform sampler2D uSceneColor;
uniform sampler2D uSceneDepth;
uniform vec2 uViewport;
uniform vec2 uNearFar;
in vec3 vPos;
in vec3 vTexPos;
flat in ivec4 vFace;
in vec3 vLight;
flat in vec4 vClim;
in vec2 vCorner;
in vec2 vFlow;
flat in float vFalling;
out vec4 outColor;
float linDepth(float d) { float z = d * 2.0 - 1.0; return 2.0 * uNearFar.x * uNearFar.y / (uNearFar.y + uNearFar.x - z * (uNearFar.y - uNearFar.x)); }
float ripple(vec2 p, float t) { return vnoise(p + vec2(t * 0.9, t * 0.4)) + vnoise(p * 2.3 - vec2(t * 0.5, t * 1.1)) * 0.5 + vnoise(p * 5.1 + vec2(t * 1.7, -t * 1.3)) * 0.25; }
void main() {
  int face = vFace.x;
  vec3 N = FN[face];
  vec3 V = normalize(uCamPos - vPos);
  bool below = !gl_FrontFacing;
  float dist = distance(vPos, uCamPos);
  float fadeR = 1.0 - clamp(dist / 90.0, 0.0, 1.0);
  vec2 flow = vFlow;
  float speed = length(flow) > 0.01 ? 1.4 : 0.6;
  if (face == 2 && fadeR > 0.0) {
    vec2 p = vPos.xz * 0.9 - flow * uTime * speed;
    float t = uTime * 0.6, e = 0.08;
    float h0 = ripple(p, t), hx = ripple(p + vec2(e, 0), t), hz = ripple(p + vec2(0, e), t);
    float k = (0.12 + 0.2 * length(flow)) * fadeR;
    N = normalize(vec3(-(hx - h0) / e * k, 1.0, -(hz - h0) / e * k));
  } else if (face != 2 && face != 3) {
    // falling water: streaks moving down the sheet
    float str = vnoise(vec2(dot(vPos.xz, vec2(1.7, 1.3)) * 3.0, vPos.y * 1.5 + uTime * 5.0));
    N = normalize(N + vec3(0, (str - 0.5) * 0.5, 0));
  }
  if (below) N = -N;
  vec2 suv = gl_FragCoord.xy / uViewport;
  float sceneZ = linDepth(texture(uSceneDepth, suv).r);
  float surfZ = linDepth(gl_FragCoord.z);
  float thick = max(0.0, sceneZ - surfZ);
  vec2 ruv = suv + N.xz * 0.03 * clamp(thick, 0.0, 1.0);
  if (linDepth(texture(uSceneDepth, ruv).r) < surfZ) ruv = suv;
  vec3 refr = texture(uSceneColor, ruv).rgb;
  vec3 absorb = exp(-vec3(0.45, 0.12, 0.08) * thick);
  vec3 body = vec3(0.02, 0.09, 0.12);
  float sky = vLight.y, skyAmb = mix(0.015, 1.0, sky * sky);
  vec3 ambient = hemi(vec3(0, 1, 0)) * skyAmb + uBlockColor * vLight.z * vLight.z;
  vec3 water = refr * absorb + body * ambient * (1.0 - absorb);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 R = reflect(-V, N);
  vec2 luv = vec2(atan(R.z, R.x) / (2.0 * PI) + 0.5, asin(clamp(R.y, -1.0, 1.0)) / PI + 0.5);
  vec3 refl = textureLod(uSkyLut, luv, 0.5).rgb * skyAmb;
  float sh = shadowAt(vPos, vec3(0, 1, 0)) * cloudShadow(vPos) * smoothstep(0.35, 0.85, sky);
  vec3 H = normalize(uLightDir + V);
  float rough = mix(0.08, 0.3, clamp(dist / 250.0, 0.0, 1.0));
  float a2 = pow(rough, 4.0), nh = max(dot(N, H), 0.0), dd = nh * nh * (a2 - 1.0) + 1.0;
  vec3 spec = uLightColor * sh * min(a2 / (PI * dd * dd), 30.0) * fres * 0.4 * max(dot(N, uLightDir), 0.0);
  vec3 col = below ? water * vec3(0.6, 0.85, 0.9) : mix(water, refl, fres) + spec;
  // foam: shallow shores, flowing water and falls
  float foamN = vnoise(vPos.xz * 3.0 + uTime * 0.3) * vnoise(vPos.xz * 7.0 - uTime * 0.2);
  float foam = (1.0 - smoothstep(0.0, 0.35, thick)) * 0.6 + length(flow) * 0.25 + vFalling * 0.6;
  foam = clamp(foam * smoothstep(0.25, 0.7, foamN + foam * 0.4), 0.0, 1.0) * fadeR;
  col = mix(col, (hemi(vec3(0, 1, 0)) * skyAmb + uLightColor * sh * 0.5) * 0.9, foam);
  outColor = vec4(applyFog(col, vPos), 1.0);
}
`;
export const WATER_VS = /* glsl */ `
layout(location=0) in vec3 aPos;
layout(location=1) in vec4 aD0;
layout(location=2) in vec4 aD1;
layout(location=3) in vec4 aD2;
uniform mat4 uViewProj;
uniform mat4 uModel;
uniform vec3 uTexOrigin;
out vec3 vPos; out vec3 vTexPos; flat out ivec4 vFace; out vec3 vLight; flat out vec4 vClim; out vec2 vCorner; out vec2 vFlow; flat out float vFalling;
void main() {
  uvec4 a = uvec4(round(aD0 * 255.0));
  vec3 p = (uModel * vec4(aPos, 1.0)).xyz;
  vPos = p; vTexPos = aPos + uTexOrigin;
  vFace = ivec4(int(a.x & 7u), 0, 0, 255);
  vLight = vec3(1.0, aD1.x, aD1.y);
  vClim = vec4(aD1.z, aD1.w, 0, 0);
  vCorner = vec2(0);
  vFlow = (aD2.zw * 255.0 - 128.0) / 127.0;
  vFalling = aD2.x;
  gl_Position = uViewProj * vec4(p, 1.0);
}
`;

// ------------------------------------------------------------------ post: bloom, god rays, tonemap
export const BRIGHT_FS = /* glsl */ `
uniform sampler2D uTex; uniform float uThreshold; in vec2 vUV; out vec4 outColor;
void main() { vec3 c = texture(uTex, vUV).rgb; float l = max(max(c.r, c.g), c.b); outColor = vec4(c * smoothstep(uThreshold, uThreshold * 2.0, l), 1.0); }
`;
export const BLUR_FS = /* glsl */ `
uniform sampler2D uTex; uniform vec2 uTexel; in vec2 vUV; out vec4 outColor;
void main() {
  vec3 c = texture(uTex, vUV).rgb * 4.0;
  c += texture(uTex, vUV + vec2(uTexel.x, 0)).rgb * 2.0 + texture(uTex, vUV - vec2(uTexel.x, 0)).rgb * 2.0;
  c += texture(uTex, vUV + vec2(0, uTexel.y)).rgb * 2.0 + texture(uTex, vUV - vec2(0, uTexel.y)).rgb * 2.0;
  c += texture(uTex, vUV + uTexel).rgb + texture(uTex, vUV - uTexel).rgb + texture(uTex, vUV + vec2(uTexel.x, -uTexel.y)).rgb + texture(uTex, vUV - vec2(uTexel.x, -uTexel.y)).rgb;
  outColor = vec4(c / 16.0, 1.0);
}
`;
// sky-only mask from depth, radially blurred toward the sun's screen position
export const GODRAY_FS = /* glsl */ `
uniform sampler2D uColor; uniform sampler2D uDepth; uniform vec2 uSunUV; uniform float uStrength;
in vec2 vUV; out vec4 outColor;
void main() {
  if (uStrength <= 0.0) { outColor = vec4(0); return; }
  vec2 d = (uSunUV - vUV) / 40.0;
  vec2 uv = vUV; vec3 acc = vec3(0); float w = 1.0;
  float jitter = fract(sin(dot(vUV, vec2(12.9898, 78.233))) * 43758.5453);
  uv += d * jitter;
  for (int i = 0; i < 40; i++) {
    float sky = texture(uDepth, uv).r >= 0.99999 ? 1.0 : 0.0;
    vec3 c = texture(uColor, uv).rgb;
    acc += min(c, vec3(4.0)) * sky * w;
    w *= 0.96; uv += d;
  }
  outColor = vec4(acc / 40.0 * uStrength, 1.0);
}
`;
export const COMPOSITE_FS = /* glsl */ `
uniform sampler2D uColor, uBloom, uBloom2, uRays;
uniform float uExposure, uBloomAmt, uUnderwater, uSaturation, uVignette;
uniform vec3 uUnderwaterColor;
uniform float uDamage;
uniform float uPortal;
uniform float uNight;
in vec2 vUV; out vec4 outColor;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
  vec2 uv = vUV;
  if (uUnderwater > 0.5) uv += vec2(sin(uv.y * 30.0 + uTime * 2.0), cos(uv.x * 25.0 + uTime * 1.7)) * 0.0025;
  if (uPortal > 0.0) { vec2 d = uv - 0.5; float a = uPortal * 1.2 * (1.0 - length(d)); uv = 0.5 + mat2(cos(a), -sin(a), sin(a), cos(a)) * d * (1.0 - uPortal * 0.15); }
  vec3 c = texture(uColor, uv).rgb;
  c += (texture(uBloom, uv).rgb * 0.45 + texture(uBloom2, uv).rgb * 0.55) * uBloomAmt;
  c += texture(uRays, uv).rgb;
  if (uUnderwater > 0.5) c = mix(c, uUnderwaterColor, 0.35);
  c *= uExposure;
  if (uNight > 0.0) {
    float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float dim = uNight * (1.0 - smoothstep(0.08, 0.6, lum));
    c = mix(c, vec3(lum) * vec3(0.62, 0.8, 1.2), dim * 0.55);
  }
  c = aces(c);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSaturation);
  vec2 v = vUV - 0.5;
  c *= 1.0 - dot(v, v) * uVignette;
  c = mix(c, vec3(0.6, 0.0, 0.0), uDamage * smoothstep(0.2, 0.75, length(v)));
  c = mix(c, vec3(0.45, 0.1, 0.75), uPortal * (0.35 + 0.4 * smoothstep(0.1, 0.7, length(v))));
  outColor = vec4(pow(c, vec3(1.0 / 2.2)), 1.0);
}
`;

// ------------------------------------------------------------------ helpers: outline, particles, crack overlay
export const LINE_VS = /* glsl */ `
layout(location=0) in vec3 aPos; uniform mat4 uViewProj; uniform vec3 uOffset; uniform float uScale;
void main() { gl_Position = uViewProj * vec4(aPos * uScale + uOffset, 1.0); }
`;
export const LINE_FS = /* glsl */ `uniform vec4 uColor; out vec4 outColor; void main() { outColor = uColor; }`;
export const CRACK_VS = /* glsl */ `
layout(location=0) in vec3 aPos; uniform mat4 uViewProj; uniform vec3 uOffset; out vec3 vLocal;
void main() { vLocal = aPos; gl_Position = uViewProj * vec4((aPos - 0.5) * 1.004 + 0.5 + uOffset, 1.0); }
`;
export const CRACK_FS = /* glsl */ `
uniform float uProgress; uniform sampler2DArray uCrack; uniform float uCrackTex; in vec3 vLocal; out vec4 outColor;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec3 a = abs(vLocal - 0.5);
  vec2 p = a.x > 0.499 ? vLocal.zy : a.y > 0.499 ? vLocal.xz : vLocal.xy;
  vec2 g = p * 6.0; vec2 i = floor(g), f = fract(g);
  float d = 1e9;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 o = vec2(x, y); vec2 c = o + vec2(h(i + o), h(i + o + 17.0)); d = min(d, length(f - c)); }
  float crack = smoothstep(0.08, 0.0, abs(d - 0.45)) * step(h(i) , uProgress * 1.2);
  outColor = vec4(0.0, 0.0, 0.0, crack * 0.75);
  if (uCrackTex > 0.5) {
    // resource-pack destroy stages (Minecraft multiplies them over the block: dark cracks, light = untouched)
    vec4 c = texture(uCrack, vec3(p.x, 1.0 - p.y, min(9.0, floor(uProgress * 10.0))));
    float dark = (1.0 - dot(c.rgb, vec3(0.333))) * c.a;
    outColor = vec4(c.rgb * 0.25, clamp(dark * 1.3, 0.0, 0.9));
  }
}
`;
export const PARTICLE_VS = /* glsl */ `
layout(location=0) in vec2 aCorner;       // quad corner -1..1
layout(location=1) in vec4 aInst;         // xyz position, w size
layout(location=2) in vec4 aColor;
uniform mat4 uViewProj; uniform vec3 uCamRight, uCamUp; uniform vec3 uStretch;
out vec4 vColor; out vec2 vC;
void main() {
  vec3 p = aInst.xyz + (uCamRight * aCorner.x + uCamUp * aCorner.y) * aInst.w + uStretch * aCorner.y;
  vColor = aColor; vC = aCorner;
  gl_Position = uViewProj * vec4(p, 1.0);
}
`;
export const PARTICLE_FS = /* glsl */ `
in vec4 vColor; in vec2 vC; uniform float uRound; out vec4 outColor;
void main() { float a = uRound > 0.5 ? smoothstep(1.0, 0.4, length(vC)) : 1.0; outColor = vec4(vColor.rgb, vColor.a * a); }
`;

// item sprites (dropped items that are not cubes, the held item): a textured quad from the icon atlas
export const SPRITE_VS = /* glsl */ `
layout(location=0) in vec2 aCorner;
uniform mat4 uViewProj; uniform vec3 uCenter, uRight, uUp; uniform vec4 uRect;
out vec2 vUV; out vec3 vPos;
void main() {
  vec3 p = uCenter + uRight * aCorner.x + uUp * aCorner.y;
  vUV = uRect.xy + (aCorner * vec2(0.5, -0.5) + 0.5) * uRect.zw;
  vPos = p;
  gl_Position = uViewProj * vec4(p, 1.0);
}
`;
export const SPRITE_FS = /* glsl */ `
uniform sampler2D uAtlas; uniform vec3 uTint; in vec2 vUV; in vec3 vPos; out vec4 outColor;
void main() {
  vec4 t = texture(uAtlas, vUV);
  if (t.a < 0.5) discard;
  outColor = vec4(applyFog(pow(t.rgb, vec3(2.2)) * uTint, vPos), 1.0);
}
`;

// ------------------------------------------------------------------ props (Unity Voxelwild/Prop + VoxelPropSurface)
export const PROP_VS = /* glsl */ `
layout(location=0) in vec3 aPos;
layout(location=1) in vec4 aNormal;
layout(location=2) in vec4 aTangent;
layout(location=3) in vec2 aUV0;
layout(location=4) in vec2 aUV1;
layout(location=5) in vec4 aColor;
layout(location=6) in vec4 iPosScale;     // pivot xyz, scale
layout(location=7) in vec4 iRotLight;     // cos yaw, sin yaw, sky light, block light
layout(location=8) in vec4 iClimate;      // temperature, humidity
uniform mat4 uViewProj;
uniform float uFoliage;
out vec3 vPos; out vec3 vN; out vec4 vT; out vec4 vColor; out vec4 vUV; flat out vec4 vLight;
vec3 rot(vec3 v) { return vec3(iRotLight.x * v.x + iRotLight.y * v.z, v.y, -iRotLight.y * v.x + iRotLight.x * v.z); }
void main() {
  vec3 p = rot(aPos * iPosScale.w) + iPosScale.xyz;
  if (uFoliage > 0.5) p += windOffset(p, aColor.a);
  vPos = p;
  vN = rot(aNormal.xyz);
  vT = vec4(rot(aTangent.xyz), aTangent.w);
  vColor = aColor;
  vUV = vec4(aUV0, aUV1);
  vLight = vec4(iRotLight.zw, iClimate.xy);
  gl_Position = uViewProj * vec4(p, 1.0);
}
`;
export const PROP_FS = /* glsl */ `
uniform sampler2DArray uAlbedo, uNormal, uMask;
uniform sampler2DArray uBakeN, uBakeM;
uniform float uMapping, uLayer, uTiling, uMoss, uFoliage, uBake, uRoughness, uEdgeWear;
uniform vec3 uTint;
in vec3 vPos; in vec3 vN; in vec4 vT; in vec4 vColor; in vec4 vUV; flat in vec4 vLight;
out vec4 outColor;
vec3 grassTint(float t, float h) {
  vec3 c = mix(mix(vec3(0.86, 0.94, 0.86), vec3(1.2, 1.03, 0.62), t), mix(vec3(0.72, 0.9, 0.82), vec3(0.78, 1.08, 0.66), t), h);
  return mix(vec3(1), c, clamp(length(vec2(t, h) - 0.5) * 2.2, 0.0, 1.0));
}
void main() {
  vec3 vn = normalize(vN);
  if (uFoliage > 0.5 && !gl_FrontFacing) vn = -vn;
  vec3 N = vn;
  vec4 baked = vec4(1.0, 0.5, 0.0, 1.0);
  if (uBake >= 0.0) {
    vec3 nts = texture(uBakeN, vec3(vUV.xy, uBake)).xyz * 2.0 - 1.0;
    vec3 T = normalize(vT.xyz - vn * dot(vn, vT.xyz));
    vec3 Bt = cross(vn, T) * vT.w;
    N = normalize(nts.x * T + nts.y * Bt + nts.z * vn);   // MikkTSpace: B = cross(N, T) * w
    baked = texture(uBakeM, vec3(vUV.xy, uBake));
  }
  int layer = int(uLayer + 0.5);
  vec3 albedo; float rough = 0.8, metal = 0.0, spec = 1.0, trans = 0.0, layerAO = 1.0;
  if (uMapping < 0.5) {
    // world-space triplanar, continuous with the blocks around it
    vec3 w = pow(abs(N), vec3(4.0)); w /= dot(w, vec3(1.0));
    vec2 uvX = vPos.zy * uTiling, uvY = vPos.xz * uTiling, uvZ = vPos.xy * uTiling;
    float L = float(layer);
    albedo = pow(texture(uAlbedo, vec3(uvX, L)).rgb, vec3(2.2)) * w.x + pow(texture(uAlbedo, vec3(uvY, L)).rgb, vec3(2.2)) * w.y + pow(texture(uAlbedo, vec3(uvZ, L)).rgb, vec3(2.2)) * w.z;
    vec4 m = texture(uMask, vec3(uvX, L)) * w.x + texture(uMask, vec3(uvY, L)) * w.y + texture(uMask, vec3(uvZ, L)) * w.z;
    float st = TLP(layer).y;
    vec3 nX = texture(uNormal, vec3(uvX, L)).xyz * 2.0 - 1.0, nY = texture(uNormal, vec3(uvY, L)).xyz * 2.0 - 1.0, nZ = texture(uNormal, vec3(uvZ, L)).xyz * 2.0 - 1.0;
    nX.xy *= st; nY.xy *= st; nZ.xy *= st;
    nX = vec3(nX.xy + N.zy, abs(nX.z) * N.x); nY = vec3(nY.xy + N.xz, abs(nY.z) * N.y); nZ = vec3(nZ.xy + N.xy, abs(nZ.z) * N.z);
    N = normalize(nX.zyx * w.x + nY.xzy * w.y + nZ.xyz * w.z);
    albedo *= TLT(layer).rgb; rough = clamp(m.g * TLP(layer).z, 0.0, 1.0); metal = m.b; spec = TLT(layer).w; layerAO = m.r;
  } else if (uMapping < 1.5) {
    vec2 uv = vUV.zw * uTiling;
    uv.y = -uv.y;
    float L = float(layer);
    albedo = pow(texture(uAlbedo, vec3(uv, L)).rgb, vec3(2.2)) * TLT(layer).rgb;
    vec4 m = texture(uMask, vec3(uv, L));
    vec3 nts = texture(uNormal, vec3(uv, L)).xyz * 2.0 - 1.0; nts.xy *= TLP(layer).y;
    vec3 T = normalize(vT.xyz - N * dot(N, vT.xyz)); vec3 Bt = cross(N, T) * vT.w;
    N = normalize(nts.x * T + nts.y * Bt + max(nts.z, 1e-3) * N);
    rough = clamp(m.g * TLP(layer).z, 0.0, 1.0); spec = TLT(layer).w; layerAO = m.r;
  } else {
    albedo = pow(vColor.rgb, vec3(2.2));
    if (uFoliage > 0.5) {
      albedo *= mix(vec3(1.0), grassTint(vLight.z, vLight.w), vUV.z);
      N = normalize(N + vec3(0, 0.8, 0));
      trans = 0.6; spec = 0.3;
    }
  }
  albedo *= uTint;
  rough = clamp(rough * uRoughness, 0.0, 1.0);
  if (uMoss > 0.0) {
    float up = clamp(N.y * 1.4 - 0.1, 0.0, 1.0);
    float moss = clamp(baked.b * uMoss * 2.5, 0.0, 1.0) * up;
    if (moss > 0.001) {
      vec2 muv = vPos.xz * 0.5;
      vec4 ma = texture(uAlbedo, vec3(muv, 20.0));
      vec3 mc = pow(ma.rgb, vec3(2.2)) * TLT(20).rgb * grassTint(vLight.z, vLight.w);
      moss = smoothstep(0.35, 0.65, moss + (ma.a - 0.5) * 0.5);
      albedo = mix(albedo, mc, moss); rough = mix(rough, 0.95, moss); spec = mix(spec, 0.3, moss);
    }
  }
  float convex = clamp((baked.g - 0.55) * 3.0, 0.0, 1.0), concave = clamp((0.45 - baked.g) * 3.0, 0.0, 1.0);
  albedo *= 1.0 + convex * uEdgeWear - concave * 0.25;
  rough = clamp(rough + convex * 0.1, 0.0, 1.0);
  if (uFoliage < 0.5 && uWet > 0.0) { float wv = uWet * smoothstep(0.55, 0.95, vLight.x); albedo *= mix(1.0, 0.62, wv); rough = mix(rough, rough * 0.4, wv); }
  if (uFoliage < 0.5 && uSnow > 0.0) { float sn = smoothstep(0.5, 0.9, clamp(N.y, 0.0, 1.0) * uSnow * smoothstep(0.55, 0.95, vLight.x)); albedo = mix(albedo, vec3(0.86, 0.9, 0.95), sn); rough = mix(rough, 0.75, sn); }
  vec3 col = shade(albedo, N, rough, metal, baked.r * layerAO, spec, vec3(0), trans, vPos, vLight.x, vLight.y, 1.0, uSkyLut);
  outColor = vec4(applyFog(col, vPos), 1.0);
}
`;
export const PROP_SHADOW_VS = /* glsl */ `
layout(location=0) in vec3 aPos;
layout(location=6) in vec4 iPosScale;
layout(location=7) in vec4 iRotLight;
uniform mat4 uViewProj;
void main() {
  vec3 v = aPos * iPosScale.w;
  vec3 p = vec3(iRotLight.x * v.x + iRotLight.y * v.z, v.y, -iRotLight.y * v.x + iRotLight.x * v.z) + iPosScale.xyz;
  gl_Position = uViewProj * vec4(p, 1.0);
}
`;
export const PROP_SHADOW_FS = /* glsl */ `out vec4 outColor; void main() { outColor = vec4(1); }`;
