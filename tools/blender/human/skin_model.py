"""Spectral skin colour model: chromophore concentrations -> diffuse albedo (linear sRGB, D65).

Two layers, after Donner & Jensen 2006 / Jimenez et al. 2010, simplified:
  epidermis: eumelanin + pheomelanin + baseline absorption, thin (~80 um), mostly absorbing
  dermis:    oxy/deoxy-haemoglobin in blood + baseline, scattering (Kubelka-Munk semi-infinite)
R(lambda) = R_epi_scatter + T_epi(lambda)^2 * R_dermis(lambda), integrated against CIE 1931 under D65.

Inputs per texel:
  Cm  melanin volume fraction in the epidermis (0.01 fair .. 0.45 very dark)
  Ch  blood volume fraction in the dermis (0.002 .. 0.2; ~0.02 typical)
  S   blood oxygen saturation (0.3 venous-blue .. 1.0)
  t   epidermis thickness factor (0.3 lips / eyelids .. 2.0 palms)
"""
from __future__ import annotations

import numpy as np

LAM = np.arange(400, 701, 10, dtype=np.float64)

# CIE 1931 2-degree colour matching functions, 400..700 nm, 10 nm
CMF = np.array([
    [0.01431, 0.000396, 0.06785], [0.04351, 0.00121, 0.2074], [0.13438, 0.004, 0.6456],
    [0.2839, 0.0116, 1.3856], [0.34828, 0.023, 1.74706], [0.3362, 0.038, 1.77211],
    [0.2908, 0.06, 1.6692], [0.19536, 0.09098, 1.28764], [0.09564, 0.13902, 0.81295],
    [0.03201, 0.20802, 0.46518], [0.0049, 0.323, 0.272], [0.0093, 0.503, 0.1582],
    [0.06327, 0.71, 0.07825], [0.1655, 0.862, 0.04216], [0.2904, 0.954, 0.0203],
    [0.43345, 0.99495, 0.00875], [0.5945, 0.995, 0.0039], [0.7621, 0.952, 0.0021],
    [0.9163, 0.87, 0.00165], [1.0263, 0.757, 0.0011], [1.0622, 0.631, 0.0008],
    [1.0026, 0.503, 0.00034], [0.85445, 0.381, 0.00019], [0.6424, 0.265, 0.00005],
    [0.4479, 0.175, 0.00002], [0.2835, 0.107, 0.0], [0.1649, 0.061, 0.0],
    [0.0874, 0.032, 0.0], [0.04677, 0.017, 0.0], [0.0227, 0.00821, 0.0], [0.01136, 0.004102, 0.0]])
D65 = np.array([82.75, 91.49, 93.43, 86.68, 104.86, 117.01, 117.81, 114.86, 115.92, 108.81, 109.35,
                107.80, 104.79, 107.69, 104.41, 104.05, 100.0, 96.33, 95.79, 88.69, 90.01, 89.60, 87.70,
                83.29, 83.70, 80.03, 80.21, 82.28, 78.28, 69.72, 71.61])
# molar extinction (cm^-1 / M), Prahl's compiled haemoglobin data resampled to 10 nm
E_HBO2 = np.array([266232, 466816, 480360, 214120, 102580, 62816, 44480, 33209, 26629, 23684, 20932,
                   20035, 24202, 39956, 53236, 43016, 32613, 44496, 50104, 14400, 3200, 1506, 942, 610,
                   442, 368, 320, 294, 277, 276, 290], np.float64)
E_HB = np.array([223296, 304256, 407560, 528600, 413280, 103292, 23388, 16156, 14550, 16684, 20862,
                 25773, 31589, 39036, 46592, 53412, 53788, 45072, 37020, 28324, 14677, 9443, 6509, 5149,
                 4345, 3750, 3227, 2795, 2407, 2051, 1794], np.float64)
XYZ2RGB = np.array([[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.2040, 1.0570]])

MU_EU = 6.6e11 * LAM ** -3.33            # eumelanin, cm^-1 (Jacques)
MU_PH = 2.9e14 * LAM ** -4.75            # pheomelanin
MU_BASE = 0.244 + 85.3 * np.exp(-(LAM - 154.0) / 66.2)
MU_S_DERMIS = 2.0e5 * LAM ** -1.5 + 2.0e12 * LAM ** -4.0     # reduced scattering, cm^-1
EPI_THICKNESS_CM = 0.0065
HB_MOLAR = 150.0 / 64500.0               # whole blood, mol/L


def spectrum(Cm, Ch, S, t, beta=0.7):
    """Reflectance spectra; inputs broadcast, result has a trailing wavelength axis."""
    Cm, Ch, S, t = (np.asarray(x, np.float64)[..., None] for x in (Cm, Ch, S, t))
    mu_epi = Cm * (beta * MU_EU + (1 - beta) * MU_PH) + (1 - Cm) * MU_BASE
    mu_blood = np.log(10) * HB_MOLAR * (S * E_HBO2 + (1 - S) * E_HB)
    mu_der = Ch * mu_blood + (1 - Ch) * MU_BASE
    k_s = mu_der / (0.75 * MU_S_DERMIS)
    r_der = 1 + k_s - np.sqrt(k_s * k_s + 2 * k_s)
    t_epi = np.exp(-2.0 * mu_epi * EPI_THICKNESS_CM * t)           # one diffuse pass (~2x path)
    r_epi = 0.035 * np.exp(-0.5 * mu_epi * EPI_THICKNESS_CM * t)    # back-scatter in the epidermis
    return r_epi + t_epi * t_epi * r_der


def to_rgb(spec):
    w = D65[:, None] * CMF
    xyz = spec @ w / w[:, 1].sum()
    rgb = xyz @ XYZ2RGB.T
    return np.clip(rgb, 0, 1)


def albedo(Cm, Ch, S=0.75, t=1.0, beta=0.7):
    return to_rgb(spectrum(Cm, Ch, S, t, beta))


class LUT:
    """4D lookup (Cm, Ch, S, t) -> linear RGB with multilinear interpolation for texture-sized inputs."""

    def __init__(self, beta=0.7):
        self.cm = np.concatenate([np.linspace(0.0, 0.1, 21), np.linspace(0.11, 0.5, 20)])
        self.ch = np.concatenate([np.linspace(0.0, 0.06, 25), np.linspace(0.065, 0.3, 16)])
        self.s = np.linspace(0.3, 1.0, 8)
        self.t = np.linspace(0.2, 2.4, 12)
        g = np.meshgrid(self.cm, self.ch, self.s, self.t, indexing="ij")
        self.table = albedo(*g, beta=beta)          # (ncm, nch, ns, nt, 3)

    def __call__(self, Cm, Ch, S, t):
        from scipy.interpolate import RegularGridInterpolator
        f = RegularGridInterpolator((self.cm, self.ch, self.s, self.t), self.table, bounds_error=False,
                                    fill_value=None)
        pts = np.stack([np.clip(Cm, 0, 0.5), np.clip(Ch, 0, 0.3), np.clip(S, 0.3, 1.0), np.clip(t, 0.2, 2.4)], -1)
        shp = pts.shape[:-1]
        out = np.empty(shp + (3,), np.float32)
        flat = pts.reshape(-1, 4)
        o = out.reshape(-1, 3)
        step = 2_000_000
        for i in range(0, len(flat), step):
            o[i:i + step] = f(flat[i:i + step])
        return out


if __name__ == "__main__":
    import noise as nz
    for name, cm, ch in (("fair I", 0.012, 0.02), ("light II", 0.025, 0.02), ("medium III", 0.05, 0.02),
                         ("olive IV", 0.09, 0.02), ("brown V", 0.18, 0.02), ("dark VI", 0.38, 0.02),
                         ("III flushed", 0.05, 0.06), ("III lips", 0.03, 0.09), ("III under-eye", 0.06, 0.03)):
        S = 0.45 if "under" in name else 0.75
        t = 0.4 if "lips" in name else 1.0
        rgb = albedo(cm, ch, S, t)
        srgb = (nz.linear_to_srgb(rgb) * 255).round().astype(int)
        print(f"{name:14s} Cm={cm:.3f} Ch={ch:.3f}  linear {np.round(rgb, 3)}  sRGB {srgb}")
