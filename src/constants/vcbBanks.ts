export interface VcbBank {
  codeName: string; // The exact string written to Excel, e.g. "(ACB) Á Châu"
  shortName: string;
  fullName: string;
}

export const VCB_BANKS: VcbBank[] = [
  { codeName: "(ACB) Á Châu", shortName: "ACB", fullName: "Ngân hàng TMCP Á Châu" },
  { codeName: "(MB) Quân Đội", shortName: "MB", fullName: "Ngân hàng TMCP Quân Đội" },
  { codeName: "(VIB) Ngân hàng Quốc tế", shortName: "VIB", fullName: "Ngân hàng TMCP Quốc tế Việt Nam" },
  { codeName: "(VCB) Vietcombank", shortName: "VCB", fullName: "Ngân hàng TMCP Ngoại Thương Việt Nam" },
  { codeName: "(BIDV) Đầu tư & Phát triển", shortName: "BIDV", fullName: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam" },
  { codeName: "(VIETINBANK) Công Thương", shortName: "CTG", fullName: "Ngân hàng TMCP Công Thương Việt Nam" },
  { codeName: "(AGRIBANK) Nông nghiệp & PTNT", shortName: "ARG", fullName: "Ngân hàng Nông nghiệp & PTNT Việt Nam" },
  { codeName: "(TECHCOMBANK) Kỹ Thương", shortName: "TCB", fullName: "Ngân hàng TMCP Kỹ Thương Việt Nam" },
  { codeName: "(VPBANK) Việt Nam Thịnh Vượng", shortName: "VPB", fullName: "Ngân hàng TMCP Việt Nam Thịnh Vượng" },
  { codeName: "(SACOMBANK) Sài Gòn Thương Tín", shortName: "STB", fullName: "Ngân hàng TMCP Sài Gòn Thương Tín" },
  { codeName: "(TPBANK) Tiên Phong", shortName: "TPB", fullName: "Ngân hàng TMCP Tiên Phong" },
  { codeName: "(HDBANK) Phát triển TP.HCM", shortName: "HDB", fullName: "Ngân hàng TMCP Phát triển Nhà TP.HCM" },
  { codeName: "(SHB) Sài Gòn - Hà Nội", shortName: "SHB", fullName: "Ngân hàng TMCP Sài Gòn - Hà Nội" },
  { codeName: "(MSB) Hàng Hải", shortName: "MSB", fullName: "Ngân hàng TMCP Hàng Hải Việt Nam" },
  { codeName: "(OCB) Phương Đông", shortName: "OCB", fullName: "Ngân hàng TMCP Phương Đông" },
  { codeName: "(LIENVIETPOSTBANK) Bưu điện Liên Việt", shortName: "LPB", fullName: "Ngân hàng TMCP Bưu Điện Liên Việt" },
  { codeName: "(SEABANK) Đông Nam Á", shortName: "SEAB", fullName: "Ngân hàng TMCP Đông Nam Á" },
  { codeName: "(EXIMBANK) Xuất Nhập khẩu", shortName: "EIB", fullName: "Ngân hàng TMCP Xuất Nhập Khẩu Việt Nam" },
  { codeName: "(SHINHAN) Shinhan Việt Nam", shortName: "SHINHAN", fullName: "Ngân hàng TNHH MTV Shinhan Việt Nam" },
  { codeName: "(ABBANK) An Bình", shortName: "ABB", fullName: "Ngân hàng TMCP An Bình" },
  { codeName: "(BACA) Bắc Á", shortName: "BAB", fullName: "Ngân hàng TMCP Bắc Á" },
  { codeName: "(SAIGONBANK) Sài Gòn Công Thương", shortName: "SGB", fullName: "Ngân hàng TMCP Sài Gòn Công Thương" },
  { codeName: "(PGBANK) Petrolimex", shortName: "PGB", fullName: "Ngân hàng TMCP Xăng dầu Petrolimex" },
  { codeName: "(SCB) Sài Gòn", shortName: "SCB", fullName: "Ngân hàng TMCP Sài Gòn" }
];
