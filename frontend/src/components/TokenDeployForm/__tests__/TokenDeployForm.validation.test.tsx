/**
 * TokenDeployForm – validation rules (#2175)
 *
 * Boundary, special-character and unicode cases for every Basic Info field,
 * the error messages and aria-invalid/aria-describedby wiring for each, and
 * the review step's dependent-field rules (metadata image + description must
 * be provided together, admin wallet must match the connected wallet).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TokenDeployForm } from '../TokenDeployForm';
import type { WalletState } from '../../../types';

const deployMock = vi.fn();

vi.mock('../../../hooks/useTokenDeploy', () => ({
    useTokenDeploy: () => ({
        deploy: deployMock,
        reset: vi.fn(),
        status: 'idle',
        statusMessage: '',
        isDeploying: false,
        error: null,
    }),
}));

vi.mock('../../../hooks/useFactoryFees', () => ({
    useFactoryFees: () => ({
        baseFee: 7,
        metadataFee: 3,
        loading: false,
        error: null,
        isFallback: false,
        refresh: vi.fn(),
    }),
}));

vi.mock('../../../hooks/useFactoryState', () => ({
    useFactoryState: () => ({ isPaused: false, loading: false, error: null, refresh: vi.fn() }),
}));

vi.mock('../../../services/analytics', () => ({
    analytics: { track: vi.fn() },
}));

const ADDRESS = `G${'A'.repeat(55)}`;
const OTHER_ADDRESS = `G${'B'.repeat(55)}`;
const MAX_SAFE_SUPPLY = String(Number.MAX_SAFE_INTEGER);

const MESSAGES = {
    name: 'Token name must be 1-32 alphanumeric characters',
    symbol: 'Token symbol must be 1-12 uppercase letters',
    decimals: 'Decimals must be between 0 and 18',
    initialSupply: 'Initial supply must be a positive number',
    adminWallet: 'Invalid Stellar address (must start with G)',
};

const LABELS = {
    name: 'Token Name',
    symbol: 'Token Symbol',
    decimals: 'Decimals',
    initialSupply: 'Initial Supply',
    adminWallet: 'Admin Wallet Address',
} as const;

type Field = keyof typeof LABELS;

const connectedWallet: WalletState = { connected: true, address: ADDRESS, network: 'testnet' };
const disconnectedWallet: WalletState = { connected: false, address: null, network: 'testnet' };

function renderBasicStep(wallet: WalletState = disconnectedWallet) {
    const utils = render(
        <TokenDeployForm wallet={wallet} onConnectWallet={vi.fn()} isConnectingWallet={false} />
    );
    fireEvent.click(screen.getByRole('button', { name: /skip templates/i }));
    return utils;
}

const field = (name: Field) => screen.getByLabelText(LABELS[name]) as HTMLInputElement;

/** Type into a field and blur it so its validation message is shown. */
function enter(name: Field, value: string) {
    const input = field(name);
    fireEvent.change(input, { target: { value } });
    fireEvent.blur(input);
    return input;
}

function expectInvalid(name: Field) {
    const input = field(name);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(MESSAGES[name]);
    expect(screen.getByText(MESSAGES[name])).toBeInTheDocument();
}

function expectValid(name: Field) {
    const input = field(name);
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText(MESSAGES[name])).not.toBeInTheDocument();
}

function fillValidBasicInfo(overrides: Partial<Record<Field, string>> = {}) {
    const values: Record<Field, string> = {
        name: 'Nova Token',
        symbol: 'NOVA',
        decimals: '7',
        initialSupply: '1000000',
        adminWallet: ADDRESS,
        ...overrides,
    };
    (Object.keys(values) as Field[]).forEach((name) => enter(name, values[name]));
}

const nextButton = () => screen.getByRole('button', { name: 'Next Step' });

describe('TokenDeployForm – validation rules', () => {
    beforeEach(() => {
        deployMock.mockReset();
        deployMock.mockResolvedValue({
            tokenAddress: `C${'A'.repeat(55)}`,
            transactionHash: 'f'.repeat(64),
            totalFee: '7',
            timestamp: Date.now(),
        });
    });

    describe('token name', () => {
        it.each([
            ['1 character', 'A'],
            ['32 characters (max)', 'A'.repeat(32)],
            ['spaces and hyphens', 'My-Token 2'],
            ['digits only', '123'],
        ])('accepts %s', (_label, value) => {
            renderBasicStep();
            enter('name', value);
            expectValid('name');
        });

        it.each([
            ['empty', ''],
            ['33 characters (max + 1)', 'A'.repeat(33)],
            ['underscore', 'my_token'],
            ['punctuation', 'Token!'],
            ['markup', '<script>'],
            ['accented letters', 'Tökén'],
            ['non-latin script', 'トークン'],
            ['emoji', 'Rocket 🚀'],
        ])('rejects %s', (_label, value) => {
            renderBasicStep();
            enter('name', value);
            expectInvalid('name');
        });

        it('limits typing to 32 characters via maxLength', () => {
            renderBasicStep();
            expect(field('name')).toHaveAttribute('maxLength', '32');
        });
    });

    describe('token symbol', () => {
        it.each([
            ['1 character', 'A'],
            ['12 characters (max)', 'A'.repeat(12)],
            ['letters and digits', 'NOVA2'],
        ])('accepts %s', (_label, value) => {
            renderBasicStep();
            enter('symbol', value);
            expectValid('symbol');
        });

        it.each([
            ['empty', ''],
            ['13 characters (max + 1)', 'A'.repeat(13)],
            ['hyphen', 'NO-VA'],
            ['space', 'NO VA'],
            ['dollar sign', '$NOVA'],
            ['accented letter', 'NOVÉ'],
            ['non-latin script', 'ΝΟΒΑ'],
            ['emoji', 'NOVA🚀'],
        ])('rejects %s', (_label, value) => {
            renderBasicStep();
            enter('symbol', value);
            expectInvalid('symbol');
        });

        it('upper-cases input before validating', () => {
            renderBasicStep();
            const input = enter('symbol', 'nova');
            expect(input.value).toBe('NOVA');
            expectValid('symbol');
        });

        it('limits typing to 12 characters via maxLength', () => {
            renderBasicStep();
            expect(field('symbol')).toHaveAttribute('maxLength', '12');
        });
    });

    describe('decimals', () => {
        it.each(['0', '7', '18'])('accepts %s', (value) => {
            renderBasicStep();
            enter('decimals', value);
            expectValid('decimals');
        });

        it.each(['-1', '19', '255'])('rejects %s', (value) => {
            renderBasicStep();
            enter('decimals', value);
            expectInvalid('decimals');
        });

        it('exposes the 0–18 range on the input', () => {
            renderBasicStep();
            expect(field('decimals')).toHaveAttribute('min', '0');
            expect(field('decimals')).toHaveAttribute('max', '18');
            expect(field('decimals')).toHaveAttribute('type', 'number');
        });

        it('defaults to 7', () => {
            renderBasicStep();
            expect(field('decimals').value).toBe('7');
        });
    });

    describe('initial supply', () => {
        it.each([
            ['1 (min)', '1'],
            ['Number.MAX_SAFE_INTEGER (max)', MAX_SAFE_SUPPLY],
        ])('accepts %s', (_label, value) => {
            renderBasicStep();
            enter('initialSupply', value);
            expectValid('initialSupply');
        });

        it.each([
            ['empty', ''],
            ['zero', '0'],
            ['negative', '-1'],
            ['MAX_SAFE_INTEGER + 1', '9007199254740992'],
            ['decimal fraction', '1.5'],
            ['scientific notation', '1e6'],
            ['thousands separator', '1,000'],
            ['letters', 'abc'],
            ['full-width digits', '１０００'],
        ])('rejects %s', (_label, value) => {
            renderBasicStep();
            enter('initialSupply', value);
            expectInvalid('initialSupply');
        });
    });

    describe('admin wallet', () => {
        it('accepts a 56-character G address', () => {
            renderBasicStep();
            enter('adminWallet', ADDRESS);
            expectValid('adminWallet');
        });

        it.each([
            ['empty', ''],
            ['contract address (C…)', `C${'A'.repeat(55)}`],
            ['55 characters', `G${'A'.repeat(54)}`],
            ['57 characters', `G${'A'.repeat(56)}`],
            ['lowercase', `g${'a'.repeat(55)}`],
            ['invalid base32 digit (1)', `G${'1'.repeat(55)}`],
            ['surrounding whitespace', ` ${ADDRESS} `],
        ])('rejects %s', (_label, value) => {
            renderBasicStep();
            enter('adminWallet', value);
            expectInvalid('adminWallet');
        });

        it('pre-fills from the connected wallet', () => {
            renderBasicStep(connectedWallet);
            expect(field('adminWallet').value).toBe(ADDRESS);
        });
    });

    describe('error display and aria attributes', () => {
        it('does not show errors or aria-invalid before a field is touched', () => {
            renderBasicStep();
            (Object.keys(LABELS) as Field[]).forEach((name) => {
                expect(field(name)).not.toHaveAttribute('aria-invalid');
                expect(screen.queryByText(MESSAGES[name])).not.toBeInTheDocument();
            });
        });

        it('describes untouched fields with their helper text', () => {
            renderBasicStep();
            expect(field('name')).toHaveAccessibleDescription(
                '1-32 characters, alphanumeric with spaces and hyphens'
            );
        });

        it('re-validates on change once a field has been touched', () => {
            renderBasicStep();
            enter('name', 'Bad_Name');
            expectInvalid('name');

            fireEvent.change(field('name'), { target: { value: 'Good Name' } });
            expectValid('name');

            fireEvent.change(field('name'), { target: { value: 'Bad_Again' } });
            expectInvalid('name');
        });

        it('shows every error with aria-invalid when an empty form is submitted', () => {
            renderBasicStep();
            fireEvent.change(field('decimals'), { target: { value: '19' } });
            fireEvent.submit(nextButton().closest('form')!);

            (Object.keys(LABELS) as Field[]).forEach(expectInvalid);
        });

        it('keeps Next disabled until all fields are valid', () => {
            renderBasicStep();
            expect(nextButton()).toBeDisabled();

            fillValidBasicInfo({ initialSupply: '0' });
            expect(nextButton()).toBeDisabled();

            enter('initialSupply', '1');
            expect(nextButton()).toBeEnabled();
        });

        it('does not advance when submitted with an invalid field', () => {
            renderBasicStep();
            fillValidBasicInfo({ symbol: 'NO-VA' });
            fireEvent.submit(nextButton().closest('form')!);

            expect(screen.queryByText('Review & Deploy')).not.toBeInTheDocument();
            expectInvalid('symbol');
        });

        it('advances to review when every field is at a valid boundary', () => {
            renderBasicStep();
            fillValidBasicInfo({
                name: 'A'.repeat(32),
                symbol: 'A'.repeat(12),
                decimals: '18',
                initialSupply: MAX_SAFE_SUPPLY,
            });
            fireEvent.click(nextButton());

            expect(screen.getByText('Review & Deploy')).toBeInTheDocument();
        });
    });

    describe('dependent fields on the review step', () => {
        function goToReview(overrides: Partial<Record<Field, string>> = {}) {
            renderBasicStep(connectedWallet);
            fillValidBasicInfo(overrides);
            fireEvent.click(nextButton());
        }

        const deployButton = () => screen.getByRole('button', { name: 'Deploy Token' });
        const description = () => screen.getByLabelText('Description');
        const imageInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;
        const image = new File(['img'], 'logo.png', { type: 'image/png' });

        it('deploys without metadata when both description and image are empty', async () => {
            goToReview();
            fireEvent.click(deployButton());

            await waitFor(() => expect(deployMock).toHaveBeenCalledTimes(1));
            expect(deployMock.mock.calls[0][0]).toMatchObject({
                name: 'Nova Token',
                symbol: 'NOVA',
                decimals: 7,
                initialSupply: '1000000',
                adminWallet: ADDRESS,
                metadata: undefined,
            });
        });

        it('requires an image when a description is entered', () => {
            goToReview();
            fireEvent.change(description(), { target: { value: 'A community token' } });
            fireEvent.click(deployButton());

            expect(
                screen.getByText('Provide both metadata image and description, or leave both empty.')
            ).toBeInTheDocument();
            expect(deployMock).not.toHaveBeenCalled();
        });

        it('requires a description when an image is selected', () => {
            goToReview();
            fireEvent.change(imageInput(), { target: { files: [image] } });
            fireEvent.click(deployButton());

            expect(
                screen.getByText('Provide both metadata image and description, or leave both empty.')
            ).toBeInTheDocument();
            expect(deployMock).not.toHaveBeenCalled();
        });

        it('treats a whitespace-only description as empty', () => {
            goToReview();
            fireEvent.change(imageInput(), { target: { files: [image] } });
            fireEvent.change(description(), { target: { value: '   ' } });
            fireEvent.click(deployButton());

            expect(deployMock).not.toHaveBeenCalled();
        });

        it('deploys with trimmed metadata when both are provided', async () => {
            goToReview();
            fireEvent.change(imageInput(), { target: { files: [image] } });
            fireEvent.change(description(), { target: { value: '  A community token  ' } });
            fireEvent.click(deployButton());

            await waitFor(() => expect(deployMock).toHaveBeenCalledTimes(1));
            expect(deployMock.mock.calls[0][0].metadata).toEqual({
                image,
                description: 'A community token',
            });
        });

        it('adds the metadata fee once metadata is entered', () => {
            goToReview();
            expect(screen.getByText(/\(if added\)/)).toBeInTheDocument();

            fireEvent.change(description(), { target: { value: 'A community token' } });
            expect(screen.queryByText(/\(if added\)/)).not.toBeInTheDocument();
        });

        it('caps the description at 500 characters', () => {
            goToReview();
            expect(description()).toHaveAttribute('maxLength', '500');
        });

        it('blocks deployment when the admin wallet differs from the connected wallet', () => {
            goToReview({ adminWallet: OTHER_ADDRESS });
            fireEvent.click(deployButton());

            expect(
                screen.getByText('Admin wallet must match the connected wallet address.')
            ).toBeInTheDocument();
            expect(deployMock).not.toHaveBeenCalled();
        });
    });
});
