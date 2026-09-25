using System;

namespace Voxelwild.Gameplay
{
    public enum GameMode : byte { Survival, Creative }

    public enum DamageCause : byte { Fall, Drowning, Starvation, Void }

    /// <summary>
    /// Health, hunger and breath. Health and hunger run 0–20 (ten hearts / ten drumsticks). Activity burns
    /// exhaustion, which eats saturation and then hunger; a well-fed player regenerates, a starving one takes damage.
    /// Falls further than 3 blocks hurt; 10 seconds of breath under water, then drowning. Engine-free.
    /// </summary>
    public sealed class SurvivalStats
    {
        public const float MaxHealth = 20f;
        public const float MaxHunger = 20f;
        public const float MaxAir = 10f;
        public const float SafeFall = 3f;

        public float Health { get; private set; } = MaxHealth;
        public float Hunger { get; private set; } = MaxHunger;
        public float Saturation { get; private set; } = 5f;
        public float Exhaustion { get; private set; }
        public float Air { get; private set; } = MaxAir;
        public bool Dead => Health <= 0f;

        float _regenTimer, _starveTimer, _drownTimer;

        public event Action<float, DamageCause> Damaged;
        public event Action<DamageCause> Died;

        public void Reset()
        {
            Health = MaxHealth;
            Hunger = MaxHunger;
            Saturation = 5f;
            Exhaustion = 0f;
            Air = MaxAir;
            _regenTimer = _starveTimer = _drownTimer = 0f;
        }

        /// <summary>Restores saved values.</summary>
        public void Load(float health, float hunger, float saturation, float air)
        {
            Health = Clamp(health, 0f, MaxHealth);
            Hunger = Clamp(hunger, 0f, MaxHunger);
            Saturation = Clamp(saturation, 0f, Hunger);
            Air = Clamp(air, 0f, MaxAir);
        }

        public void AddExhaustion(float amount)
        {
            Exhaustion += amount;
            while (Exhaustion >= 4f)
            {
                Exhaustion -= 4f;
                if (Saturation > 0f) Saturation = Math.Max(0f, Saturation - 1f);
                else Hunger = Math.Max(0f, Hunger - 1f);
            }
        }

        public void Eat(int food, float saturation)
        {
            Hunger = Math.Min(MaxHunger, Hunger + food);
            Saturation = Math.Min(Hunger, Saturation + saturation);
        }

        public void Damage(float amount, DamageCause cause)
        {
            if (Dead || amount <= 0f) return;
            Health = Math.Max(0f, Health - amount);
            AddExhaustion(0.1f);
            Damaged?.Invoke(amount, cause);
            if (Dead) Died?.Invoke(cause);
        }

        /// <summary>Landing after a fall of <paramref name="distance"/> blocks (water breaks the fall).</summary>
        public void Land(float distance, bool intoWater)
        {
            if (intoWater) return;
            float dmg = (float)Math.Floor(distance - SafeFall);
            if (dmg > 0f) Damage(dmg, DamageCause.Fall);
        }

        /// <summary>
        /// Advances time. <paramref name="moved"/> metres travelled (sprinting counts extra), jumps this step,
        /// and whether the head is under water.
        /// </summary>
        public void Tick(float dt, float moved, bool sprinting, int jumps, bool headUnderwater)
        {
            if (Dead) return;
            AddExhaustion(moved * (sprinting ? 0.1f : 0.01f) + jumps * (sprinting ? 0.2f : 0.05f) + dt * 0.005f);

            if (headUnderwater)
            {
                Air = Math.Max(0f, Air - dt);
                if (Air <= 0f)
                {
                    _drownTimer += dt;
                    while (_drownTimer >= 1f) { _drownTimer -= 1f; Damage(2f, DamageCause.Drowning); }
                }
            }
            else
            {
                Air = Math.Min(MaxAir, Air + dt * 5f);
                _drownTimer = 0f;
            }

            if (Hunger >= 18f && Health < MaxHealth)
            {
                // well fed: a point every 4 s (faster while saturated), paid for in exhaustion
                _regenTimer += dt * (Saturation > 0f ? 2f : 1f);
                while (_regenTimer >= 4f && Health < MaxHealth)
                {
                    _regenTimer -= 4f;
                    Health = Math.Min(MaxHealth, Health + 1f);
                    AddExhaustion(6f);
                }
            }
            else _regenTimer = 0f;

            if (Hunger <= 0f)
            {
                _starveTimer += dt;
                while (_starveTimer >= 4f) { _starveTimer -= 4f; if (Health > 1f) Damage(1f, DamageCause.Starvation); }
            }
            else _starveTimer = 0f;
        }

        static float Clamp(float v, float lo, float hi) => v < lo ? lo : v > hi ? hi : v;
    }
}
