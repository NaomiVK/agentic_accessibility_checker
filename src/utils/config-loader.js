"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadUrls = loadUrls;
exports.validateUrls = validateUrls;
const fs_1 = require("fs");
const path_1 = require("path");
function loadUrls(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const fullPath = (0, path_1.join)(process.cwd(), filePath);
            const fileContent = (0, fs_1.readFileSync)(fullPath, 'utf-8');
            return JSON.parse(fileContent);
        }
        catch (error) {
            throw new Error(`Failed to load URLs from ${filePath}: ${error}`);
        }
    });
}
function validateUrls(urls) {
    const validUrls = [];
    for (const url of urls) {
        try {
            new URL(url);
            validUrls.push(url);
        }
        catch (error) {
            console.warn(`WARNING: Invalid URL skipped: ${url}`);
        }
    }
    return validUrls;
}
