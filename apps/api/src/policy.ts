import type { ChainState } from "@trust0/identity";

export function assertAppendAuthorized(
	state: ChainState,
	signerFingerprint: string,
): void {
	if (!state.activeFingerprints.has(signerFingerprint)) {
		throw new Error("Signer is not an active key for this identity");
	}
}

export function classifyProfileUpdate(
	state: ChainState,
	currentFingerprint: string,
	signerFingerprint: string,
): "same-key" | "rotated-key" {
	if (currentFingerprint === signerFingerprint) {
		return "same-key";
	}

	if (!state.activeFingerprints.has(signerFingerprint)) {
		throw new Error("Signer is not an active key for this identity");
	}

	return "rotated-key";
}

export function assertProfileMatchesChainState(
	state: ChainState,
	profileFingerprint: string,
): void {
	if (
		state.currentProfileFingerprint !== null &&
		state.currentProfileFingerprint !== profileFingerprint
	) {
		throw new Error("Profile fingerprint does not match the sigchain's current profile");
	}

	if (
		state.currentProfileFingerprint === null &&
		!state.activeFingerprints.has(profileFingerprint)
	) {
		throw new Error("Profile fingerprint is not authorized by the sigchain");
	}
}
