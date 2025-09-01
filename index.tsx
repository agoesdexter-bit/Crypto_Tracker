/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from "@google/genai";

// --- TYPES & STATE ---
type Crypto = {
    name: string;
    symbol: string;
    price_usd: number;
    ath_usd: number;
    blockchain: string;
    holdings: number;
};

let cryptocurrencies: Crypto[] = [];
let exchangeRateUSDtoIDR: number = 0;
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const STORAGE_KEY = 'cryptoPortfolioTracker';

// --- LOCAL STORAGE ---
const saveState = () => {
    try {
        const state = { cryptocurrencies, exchangeRateUSDtoIDR };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
        console.error("Could not save state to localStorage", error);
    }
};

const loadState = (): boolean => {
    try {
        const savedState = localStorage.getItem(STORAGE_KEY);
        if (savedState) {
            const { cryptocurrencies: savedCryptos, exchangeRateUSDtoIDR: savedRate } = JSON.parse(savedState);
            cryptocurrencies = savedCryptos || [];
            exchangeRateUSDtoIDR = savedRate || 0;
            return true;
        }
    } catch (error) {
        console.error("Could not load state from localStorage", error);
    }
    return false;
};


// --- UI HELPERS ---
const createCryptoIconHTML = (symbol: string): string => {
    const colors = ["#f0b90b", "#f8a5c2", "#b39ddb", "#81c784", "#ffab91", "#80deea", "#c5e1a5", "#ffcc80"];
    const charCodeSum = symbol.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const color = colors[charCodeSum % colors.length];
    const initial = symbol.charAt(0).toUpperCase();
    return `<div class="crypto-icon" style="background-color: ${color};">${initial}</div>`;
}

const createTableRowHTML = (crypto: Crypto): string => {
    const usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    const idrFormatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' });
    return `
        <td class="crypto-info">
            ${createCryptoIconHTML(crypto.symbol)}
            <div class="crypto-name">
                <span>${crypto.name}</span>
                <span class="symbol">${crypto.symbol.toUpperCase()}</span>
            </div>
        </td>
        <td>${crypto.blockchain}</td>
        <td class="numeric">${usdFormatter.format(crypto.ath_usd)}</td>
        <td class="numeric">${usdFormatter.format(crypto.price_usd)}</td>
        <td class="numeric">${idrFormatter.format(crypto.price_usd * exchangeRateUSDtoIDR)}</td>
        <td class="numeric">${crypto.holdings.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
        <td class="numeric">${usdFormatter.format(crypto.price_usd * crypto.holdings)}</td>
        <td><button class="add-asset-btn" data-symbol="${crypto.symbol.toUpperCase()}" aria-label="Add assets for ${crypto.name}">Add</button></td>
    `;
};


// --- RENDER FUNCTIONS ---
const appContainer = document.getElementById('app');

const renderLoading = () => {
    const tableContainer = document.getElementById('table-container');
    if (tableContainer) {
        tableContainer.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                Fetching initial crypto data...
            </div>`;
    }
};

const renderError = (message: string) => {
    const tableContainer = document.getElementById('table-container');
    if (tableContainer) {
        tableContainer.innerHTML = `<p class="error">Error: ${message}</p>`;
    }
};

const renderCryptoTable = () => {
    const tableContainer = document.getElementById('table-container');
    if (!tableContainer) return;

    if (cryptocurrencies.length === 0) {
        tableContainer.innerHTML = `<p class="loading">Your portfolio is empty. Add a cryptocurrency to begin.</p>`;
        return;
    }

    const tableRows = cryptocurrencies.map((crypto: Crypto) => `
        <tr class="fade-in">
            ${createTableRowHTML(crypto)}
        </tr>
    `).join('');

    tableContainer.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Crypto</th>
                    <th>Blockchain</th>
                    <th class="numeric">Last ATH</th>
                    <th class="numeric">Price Now (USD)</th>
                    <th class="numeric">Price Now (IDR)</th>
                    <th class="numeric">Holdings</th>
                    <th class="numeric">Value (USD)</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
    `;
};

const renderAppLayout = () => {
    if (!appContainer) return;

    appContainer.innerHTML = `
        <div class="container">
            <h1>Crypto Portfolio Tracker</h1>
            <form id="add-crypto-form" class="add-crypto-form" aria-label="Add new cryptocurrency">
                <input type="text" id="crypto-input" placeholder="e.g., Cardano or ADA" required aria-label="Cryptocurrency name or symbol">
                <button type="submit" id="add-crypto-btn">Add Crypto</button>
            </form>
            <div id="table-container"></div>
        </div>
    `;

    document.getElementById('add-crypto-form')?.addEventListener('submit', handleAddCrypto);
    document.getElementById('table-container')?.addEventListener('click', handleTableClick);
};

const addCryptoToTable = (crypto: Crypto) => {
    let table = document.querySelector('table');
    if (!table) {
        // If table doesn't exist, render the whole thing
        renderCryptoTable();
        return;
    }
    const tbody = table.querySelector('tbody');
    if (tbody) {
        const newRow = document.createElement('tr');
        newRow.classList.add('fade-in');
        newRow.innerHTML = createTableRowHTML(crypto);
        tbody.appendChild(newRow);
    }
}


// --- EVENT HANDLERS & API ---
const handleAddAsset = (symbol: string) => {
    const crypto = cryptocurrencies.find(c => c.symbol.toUpperCase() === symbol.toUpperCase());
    if (!crypto) return;

    const amountStr = prompt(`How much ${crypto.name} (${symbol}) are you adding?`);
    if (amountStr) {
        const amount = parseFloat(amountStr.replace(/,/g, ''));
        if (!isNaN(amount) && amount > 0) {
            crypto.holdings = (crypto.holdings || 0) + amount;
            saveState();
            // Re-render the table to update holdings and value
            renderCryptoTable();
        } else {
            alert("Please enter a valid positive number.");
        }
    }
};

const handleTableClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.classList.contains('add-asset-btn')) {
        const symbol = target.dataset.symbol;
        if (symbol) {
            handleAddAsset(symbol);
        }
    }
};

const handleAddCrypto = async (event: Event) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const input = document.getElementById('crypto-input') as HTMLInputElement;
    const button = document.getElementById('add-crypto-btn') as HTMLButtonElement;
    const cryptoName = input.value.trim();

    if (!cryptoName) return;

    if (cryptocurrencies.some(c => c.name.toLowerCase() === cryptoName.toLowerCase() || c.symbol.toLowerCase() === cryptoName.toLowerCase())) {
        alert(`${cryptoName} is already in your portfolio.`);
        input.value = '';
        return;
    }

    button.disabled = true;
    button.textContent = 'Adding...';

    try {
        const singleCryptoSchema = {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING },
                symbol: { type: Type.STRING },
                price_usd: { type: Type.NUMBER },
                ath_usd: { type: Type.NUMBER },
                blockchain: { type: Type.STRING },
            },
            required: ["name", "symbol", "price_usd", "ath_usd", "blockchain"]
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Provide the current price, all-time high price, and blockchain (e.g., Ethereum, Solana, etc.) for the cryptocurrency: ${cryptoName}.`,
            config: { responseMimeType: "application/json", responseSchema: singleCryptoSchema },
        });

        const newCryptoData = JSON.parse(response.text);
        const newCrypto: Crypto = { ...newCryptoData, holdings: 0 };
        cryptocurrencies.push(newCrypto);
        saveState();
        addCryptoToTable(newCrypto);
        form.reset();

    } catch (error) {
        console.error('Error adding crypto:', error);
        alert(`Could not fetch data for "${cryptoName}". The token may not be in the Gemini model's database. Please try another name.`);
    } finally {
        button.disabled = false;
        button.textContent = 'Add Crypto';
    }
};

async function main() {
    renderAppLayout();
    const stateLoaded = loadState();

    if (stateLoaded && cryptocurrencies.length > 0) {
        console.log("Loaded portfolio from localStorage.");
        renderCryptoTable();
    } else {
        renderLoading();
        try {
            const initialListSchema = {
                type: Type.OBJECT,
                properties: {
                    cryptocurrencies: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING },
                                symbol: { type: Type.STRING },
                                price_usd: { type: Type.NUMBER },
                                ath_usd: { type: Type.NUMBER },
                                blockchain: { type: Type.STRING },
                            },
                             required: ["name", "symbol", "price_usd", "ath_usd", "blockchain"]
                        }
                    },
                    exchangeRateUSDtoIDR: { type: Type.NUMBER }
                },
                required: ["cryptocurrencies", "exchangeRateUSDtoIDR"]
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: 'Provide the current price, all-time high price, and blockchain for Bitcoin, Ethereum, Solana, and BNB. Also, provide the current USD to IDR exchange rate.',
                config: { responseMimeType: "application/json", responseSchema: initialListSchema },
            });

            const data = JSON.parse(response.text);
            cryptocurrencies = data.cryptocurrencies.map((c: any) => ({ ...c, holdings: 0 }));
            exchangeRateUSDtoIDR = data.exchangeRateUSDtoIDR;
            
            saveState();
            renderCryptoTable();

        } catch (error) {
            console.error(error);
            renderError('Could not fetch initial data from the Gemini API. Please refresh the page or check the console.');
        }
    }
}

main();