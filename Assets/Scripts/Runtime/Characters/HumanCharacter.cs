using System.Collections.Generic;
using Unity.Mathematics;
using UnityEngine;
using Voxelwild.World;

namespace Voxelwild.Characters
{
    /// <summary>
    /// Keeps a human character alive and lit like the voxel world around it:
    ///  - blinks (blend shapes eyeBlinkLeft/Right on every skinned mesh that has them: body, lashes,
    ///    tear lines, occlusion shells), with natural timing and the lids following downward gaze;
    ///  - drives the eye bones toward a look target with micro-saccades and fixation drift;
    ///  - samples sky exposure (heightmap) and block light (nearby emitters) and feeds _VoxelSky /
    ///    _VoxelBlock to the character shaders, plus pupil size from the light level.
    /// </summary>
    [DisallowMultipleComponent]
    public sealed class HumanCharacter : MonoBehaviour
    {
        [Header("Eyes")]
        [SerializeField] Transform lookTarget;
        [SerializeField] string leftEyeBone = "mixamorig:LeftEye";
        [SerializeField] string rightEyeBone = "mixamorig:RightEye";
        [SerializeField, Range(0f, 45f)] float maxYaw = 32f;
        [SerializeField, Range(0f, 40f)] float maxPitch = 22f;
        [SerializeField, Range(0f, 3f)] float saccadeAmplitude = 0.8f;

        [Header("Blinking")]
        [SerializeField] Vector2 blinkInterval = new Vector2(2.0f, 6.5f);
        [SerializeField, Range(0.05f, 0.5f)] float blinkDuration = 0.22f;
        [SerializeField, Range(0f, 1f)] float lidFollow = 0.45f;

        [Header("Voxel lighting")]
        [SerializeField] VoxelWorld world;
        [SerializeField, Range(1, 10)] int blockLightRadius = 6;
        [SerializeField, Range(0.05f, 2f)] float lightSampleInterval = 0.25f;

        static readonly int SkyId = Shader.PropertyToID("_VoxelSky");
        static readonly int BlockId_ = Shader.PropertyToID("_VoxelBlock");
        static readonly int PupilId = Shader.PropertyToID("_PupilScale");

        readonly List<(SkinnedMeshRenderer r, int left, int right)> _blinkTargets = new();
        Renderer[] _renderers;
        MaterialPropertyBlock _mpb;
        Transform _leftEye, _rightEye, _head;
        Quaternion _leftRest, _rightRest;
        float _nextBlink, _blinkT = -1f, _nextSaccade;
        Vector2 _saccade, _saccadeTarget;
        float _sky = 1f, _block, _skySmooth = 1f, _blockSmooth, _nextLightSample;
        float _pupil = 1f;

        public Transform LookTarget { get => lookTarget; set => lookTarget = value; }

        void Awake()
        {
            _renderers = GetComponentsInChildren<Renderer>(true);
            _mpb = new MaterialPropertyBlock();
            foreach (var smr in GetComponentsInChildren<SkinnedMeshRenderer>(true))
            {
                var m = smr.sharedMesh;
                if (m == null) continue;
                int l = m.GetBlendShapeIndex("eyeBlinkLeft"), r = m.GetBlendShapeIndex("eyeBlinkRight");
                if (l >= 0 || r >= 0) _blinkTargets.Add((smr, l, r));
            }
            foreach (var t in GetComponentsInChildren<Transform>(true))
            {
                if (t.name == leftEyeBone) _leftEye = t;
                else if (t.name == rightEyeBone) _rightEye = t;
                else if (t.name.EndsWith(":Head") || t.name == "Head") _head = t;
            }
            if (_leftEye) _leftRest = _leftEye.localRotation;
            if (_rightEye) _rightRest = _rightEye.localRotation;
            if (world == null) world = FindAnyObjectByType<VoxelWorld>();
            ScheduleBlink();
        }

        void ScheduleBlink() => _nextBlink = Time.time + UnityEngine.Random.Range(blinkInterval.x, blinkInterval.y);

        void LateUpdate()
        {
            float pitch = UpdateEyes();
            UpdateBlink(pitch);
            UpdateLighting();
        }

        float UpdateEyes()
        {
            if (_leftEye == null || _rightEye == null) return 0f;
            // micro-saccades: small jumps every 0.3-1.2 s, eased in over ~40 ms
            if (Time.time >= _nextSaccade)
            {
                _saccadeTarget = UnityEngine.Random.insideUnitCircle * saccadeAmplitude;
                _nextSaccade = Time.time + UnityEngine.Random.Range(0.3f, 1.2f);
            }
            _saccade = Vector2.Lerp(_saccade, _saccadeTarget, 1f - Mathf.Exp(-Time.deltaTime / 0.04f));

            Transform reference = _head != null ? _head : transform;
            float yaw = 0f, pitch = 0f;
            if (lookTarget != null)
            {
                Vector3 mid = (_leftEye.position + _rightEye.position) * 0.5f;
                Vector3 local = reference.InverseTransformDirection((lookTarget.position - mid).normalized);
                yaw = Mathf.Atan2(local.x, local.z) * Mathf.Rad2Deg;
                pitch = Mathf.Asin(Mathf.Clamp(local.y, -1f, 1f)) * Mathf.Rad2Deg;
            }
            yaw = Mathf.Clamp(yaw + _saccade.x, -maxYaw, maxYaw);
            pitch = Mathf.Clamp(pitch + _saccade.y, -maxPitch, maxPitch);
            Quaternion gaze = Quaternion.Euler(-pitch, yaw, 0f);
            // rotate about the head's axes, applied on top of each eye's rest pose
            _leftEye.rotation = reference.rotation * gaze * Quaternion.Inverse(reference.rotation) * (_leftEye.parent.rotation * _leftRest);
            _rightEye.rotation = reference.rotation * gaze * Quaternion.Inverse(reference.rotation) * (_rightEye.parent.rotation * _rightRest);
            return pitch;
        }

        void UpdateBlink(float pitch)
        {
            if (_blinkT < 0f && Time.time >= _nextBlink) _blinkT = 0f;
            float w = 0f;
            if (_blinkT >= 0f)
            {
                _blinkT += Time.deltaTime / blinkDuration;
                // fast close (35%), slower open
                w = _blinkT < 0.35f ? Mathf.SmoothStep(0f, 1f, _blinkT / 0.35f) : Mathf.SmoothStep(1f, 0f, (_blinkT - 0.35f) / 0.65f);
                if (_blinkT >= 1f)
                {
                    _blinkT = -1f;
                    w = 0f;
                    ScheduleBlink();
                    if (UnityEngine.Random.value < 0.12f) _nextBlink = Time.time + 0.18f;  // occasional double blink
                }
            }
            // upper lids follow a downward gaze
            float follow = Mathf.Clamp01(-pitch / maxPitch) * lidFollow;
            float weight = Mathf.Clamp01(Mathf.Max(w, follow)) * 100f;
            foreach (var (r, l, rr) in _blinkTargets)
            {
                if (l >= 0) r.SetBlendShapeWeight(l, weight);
                if (rr >= 0) r.SetBlendShapeWeight(rr, weight);
            }
        }

        void UpdateLighting()
        {
            if (Time.time >= _nextLightSample)
            {
                _nextLightSample = Time.time + lightSampleInterval;
                SampleVoxelLight();
            }
            float k = 1f - Mathf.Exp(-Time.deltaTime / 0.35f);
            _skySmooth = Mathf.Lerp(_skySmooth, _sky, k);
            _blockSmooth = Mathf.Lerp(_blockSmooth, _block, k);
            // pupils: dilate in the dark (slow), constrict in light
            float target = Mathf.Lerp(1.55f, 0.85f, Mathf.Max(_skySmooth, _blockSmooth * 0.8f));
            _pupil = Mathf.Lerp(_pupil, target, 1f - Mathf.Exp(-Time.deltaTime / (target > _pupil ? 1.5f : 0.3f)));
            foreach (var r in _renderers)
            {
                if (r == null) continue;
                int count = r.sharedMaterials.Length;
                for (int i = 0; i < count; i++)
                {
                    r.GetPropertyBlock(_mpb, i);
                    _mpb.SetFloat(SkyId, _skySmooth);
                    _mpb.SetFloat(BlockId_, _blockSmooth);
                    _mpb.SetFloat(PupilId, _pupil);
                    r.SetPropertyBlock(_mpb, i);
                }
            }
        }

        void SampleVoxelLight()
        {
            if (world == null) { _sky = 1f; _block = 0f; return; }
            Vector3 p = _head != null ? _head.position : transform.position + Vector3.up * 1.6f;
            var cell = new int3(Mathf.FloorToInt(p.x), Mathf.FloorToInt(p.y), Mathf.FloorToInt(p.z));
            // sky: open above -> 1; under cover, fall off with the depth below the light-blocking surface
            float sky = 0f, n = 0f;
            for (int dz = -1; dz <= 1; dz++)
            for (int dx = -1; dx <= 1; dx++)
            {
                int? h = world.GetHeightmap(cell.x + dx * 2, cell.z + dz * 2);
                if (h == null) continue;
                float depth = h.Value - cell.y;
                sky += depth < 0 ? 1f : Mathf.Clamp01(1f - depth / 10f) * 0.6f;
                n += 1f;
            }
            _sky = n > 0 ? Mathf.Clamp01(sky / n) : 1f;
            // block light: strongest emitter in range, 1/15 per block of distance like the voxel BFS
            float best = 0f;
            int rad = blockLightRadius;
            for (int y = -rad; y <= rad; y++)
            for (int z = -rad; z <= rad; z++)
            for (int x = -rad; x <= rad; x++)
            {
                if (!world.TryGetBlock(cell + new int3(x, y, z), out ushort b) || b == Voxelwild.World.BlockId.Air) continue;
                byte e = BlockRegistry.Get(b).LightEmission;
                if (e == 0) continue;
                float lvl = (e - (Mathf.Abs(x) + Mathf.Abs(y) + Mathf.Abs(z))) / 15f;
                if (lvl > best) best = lvl;
            }
            _block = Mathf.Clamp01(best);
        }
    }
}
