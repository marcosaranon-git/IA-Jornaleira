require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const geminiKey = process.env.GEMINI_API_KEY;

if (!geminiKey) {
    console.error("❌ Falta a chave do Gemini no arquivo .env!");
    process.exit(1);
}

// Inicializa a conexão com o Google
const genAI = new GoogleGenerativeAI(geminiKey);

console.log("🧠 Conexão com o Google Gemini preparada!");

module.exports = genAI;