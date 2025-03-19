/**
 * Encryption utility functions using crypto-js
 */

import CryptoJS from "crypto-js";

/**
 * Encrypts a string with AES using the provided password
 *
 * @param text The string to encrypt
 * @param password The password to use for encryption
 * @returns The encrypted string
 */
export const encryptText = (text: string, password: string): string => {
	return CryptoJS.AES.encrypt(text, password).toString();
};

/**
 * Decrypts an encrypted string with AES using the provided password
 *
 * @param encryptedText The encrypted string
 * @param password The password to use for decryption
 * @returns The decrypted string or empty string if decryption fails
 */
export const decryptText = (
	encryptedText: string,
	password: string,
): string => {
	try {
		const bytes = CryptoJS.AES.decrypt(encryptedText, password);
		return bytes.toString(CryptoJS.enc.Utf8);
	} catch (error) {
		console.error("Decryption failed:", error);
		return "";
	}
};

/**
 * Generates a hash of the password for storage and comparison
 *
 * @param password The password to hash
 * @returns The hashed password
 */
export const hashPassword = (password: string): string => {
	return CryptoJS.SHA256(password).toString();
};

/**
 * Verifies if the provided password matches the stored hash
 *
 * @param password The password to verify
 * @param storedHash The stored hash to compare against
 * @returns True if the password matches, false otherwise
 */
export const verifyPassword = (
	password: string,
	storedHash: string,
): boolean => {
	const hashedPassword = hashPassword(password);
	return hashedPassword === storedHash;
};
