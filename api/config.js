export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    shopName: process.env.SHOP_NAME || "embe Tít",
    bankBin: process.env.BANK_BIN || "",
    bankAccountNo: process.env.BANK_ACCOUNT_NO || "",
    bankAccountName: process.env.BANK_ACCOUNT_NAME || "",
  });
}
