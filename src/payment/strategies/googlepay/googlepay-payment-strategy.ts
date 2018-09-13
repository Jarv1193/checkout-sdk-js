import {createAction, createErrorAction} from '@bigcommerce/data-store';

import {isInternalAddressEqual, mapFromInternalAddress, mapToInternalAddress} from '../../../address';
import InternalAddress from '../../../address/internal-address';
import {BillingAddressActionCreator} from '../../../billing';
import CheckoutStore from '../../../checkout/checkout-store';
import { CheckoutActionCreator } from '../../../checkout/index';
import InternalCheckoutSelectors from '../../../checkout/internal-checkout-selectors';
import { InvalidArgumentError, MissingDataError, MissingDataErrorType, StandardError } from '../../../common/error/errors/index';
import { OrderActionCreator, OrderRequestBody } from '../../../order/index';
import {RemoteCheckoutActionCreator} from '../../../remote-checkout';
import {RemoteCheckoutSynchronizationError} from '../../../remote-checkout/errors';
import ConsignmentActionCreator from '../../../shipping/consignment-action-creator';
import {ShippingStrategyActionType} from '../../../shipping/shipping-strategy-actions';
import { PaymentActionCreator, PaymentMethodActionCreator, PaymentStrategyActionCreator } from '../../index';
import PaymentMethod from '../../payment-method';
import { PaymentInitializeOptions, PaymentRequestOptions } from '../../payment-request-options';
import PaymentStrategy from '../payment-strategy';

import {
    BraintreeGooglePayPaymentInitializeOptions,
    EnvironmentType,
    GooglePaymentsError,
    GooglePaymentData,
    GooglePayBraintreePaymentDataRequest,
    GooglePayBraintreeSDK,
    GooglePayClient,
    GooglePayIsReadyToPayResponse,
    GooglePayPaymentDataRequest,
    GooglePayPaymentOptions,
    GooglePaySDK,
    GATEWAY,
    PaymentSuccessPayload,
    TokenizePayload
} from './googlepay';
import GooglePayPaymentProcessor from './googlepay-payment-processor';
import GooglePayScriptLoader from './googlepay-script-loader';

export default class GooglePayPaymentStrategy extends PaymentStrategy {
    private _googlePaymentsClient!: GooglePayClient;
    private _googlePaymentInstance!: GooglePayBraintreeSDK;
    private _googlePayOptions!: BraintreeGooglePayPaymentInitializeOptions;
    private _methodId!: string;
    private _paymentMethod?: PaymentMethod;
    private _walletButton?: HTMLElement;

    constructor(
        store: CheckoutStore,
        private _checkoutActionCreator: CheckoutActionCreator,
        private _paymentMethodActionCreator: PaymentMethodActionCreator,
        private _paymentStrategyActionCreator: PaymentStrategyActionCreator,
        private _paymentActionCreator: PaymentActionCreator,
        private _orderActionCreator: OrderActionCreator,
        private _googlePayScriptLoader: GooglePayScriptLoader,
        private _googlePayPaymentProcessor: GooglePayPaymentProcessor,
        private _billingAddressActionCreator: BillingAddressActionCreator,
        private _remoteCheckoutActionCreator: RemoteCheckoutActionCreator,
        private _consignmentActionCreator: ConsignmentActionCreator
    ) {
        super(store);
    }

    initialize(options: PaymentInitializeOptions): Promise<InternalCheckoutSelectors> {
        const { methodId, googlepay: googlePayOptions } = options;

        if (!googlePayOptions) {
            throw new InvalidArgumentError('Unable to initialize payment because "options.googlepay" argument is not provided.');
        }

        this._googlePayOptions = options.googlepay;

        const walletButton = options.googlepay.walletButton && document.getElementById(options.googlepay.walletButton);

        if (walletButton) {
            this._walletButton = walletButton;
            this._walletButton.addEventListener('click', this._handleWalletButtonClick);
        }

        return this._configureWallet()
            .then(() => super.initialize(options));
    }

                this._paymentMethod = state.paymentMethods.getPaymentMethod(methodId);

                if (!this._paymentMethod || !this._paymentMethod.clientToken || !this._paymentMethod.initializationData.gateway) {
                    throw new MissingDataError(MissingDataErrorType.MissingPaymentMethod);
                }

                const gateway = this._paymentMethod.initializationData.gateway;

                return Promise.all([
                    this._googlePayScriptLoader.load(),
                    this._googlePayPaymentProcessor.initialize(this._paymentMethod.clientToken, gateway), // TODO: Create googlePayCreateProcessor to support multiple gateway (new approach)
                ])
                .then(([googlePay, googlePaymentInstance]) => {
                    const paymentsClient = this._getGooglePaymentsClient(googlePay);
                    const button = document.querySelector('#GooglePayContainer') as Element;

                    if (GATEWAY.braintree === gateway) {
                        this._braintreeGooglePayInitializer(paymentsClient, googlePaymentInstance, button, googlePayOptions);
                    }
                })
                .catch((error: Error) => {
                    this._handleError(error);
                });
            }).then(() => super.initialize(options));
    }

    execute(payload: OrderRequestBody, options?: PaymentRequestOptions): Promise<InternalCheckoutSelectors> {
        return this._getPayment()
            .catch(error => {
                if (error.subtype === MissingDataErrorType.MissingPayment) {
                    return this._displayWallet()
                        .then(() => this._getPayment());
                }

                throw error;
            })
            .then(payment =>
                this._createOrder(payment, payload.useStoreCredit, options)
            );
    }

    private _synchronizeBillingAddress(): Promise<InternalCheckoutSelectors> {
        const methodId = this._paymentMethod && this._paymentMethod.id;

        if (!methodId) {
            throw new RemoteCheckoutSynchronizationError();
        }

        return this._store.dispatch(
            this._remoteCheckoutActionCreator.initializeBilling(methodId, { referenceId: '' })
        )
            .then(state => {
                const billingAddress = state.billingAddress.getBillingAddress();
                const internalBillingAddress = billingAddress && mapToInternalAddress(billingAddress);
                if (!billingAddress) {
                    throw new Error('error');
                }
                const remoteAddress: InternalAddress = mapToInternalAddress(billingAddress); // TODO: Update with the wallet's address
                remoteAddress.addressLine1 = 'known street example BILLING';

                return this._store.dispatch(
                    this._billingAddressActionCreator.updateAddress(mapFromInternalAddress(remoteAddress))
                );
            });
    }

    private _synchronizeShippingAddress(): Promise<InternalCheckoutSelectors> {
        const methodId = this._paymentMethod && this._paymentMethod.id;

        if (!methodId) {
            throw new RemoteCheckoutSynchronizationError();
        }

        return this._store.dispatch(
            createAction(ShippingStrategyActionType.UpdateAddressRequested, undefined, { methodId })
        )
            .then(() => this._store.dispatch(
                this._remoteCheckoutActionCreator.initializeShipping(methodId, { referenceId: '' })
            ))
            .then(state => {
                const address = state.shippingAddress.getShippingAddress();

                if (!address) {
                    throw new Error('error');
                }

                const remoteAddress: InternalAddress = mapToInternalAddress(address); // TODO: Update with the wallet's address
                remoteAddress.addressLine1 = 'known street example SHIPPING';

                return this._store.dispatch(
                    this._consignmentActionCreator.updateAddress(mapFromInternalAddress(remoteAddress))
                );
            })
            .then(() => this._store.dispatch(
                createAction(ShippingStrategyActionType.UpdateAddressSucceeded, undefined, { methodId })
            ))
            .catch(error => this._store.dispatch(
                createErrorAction(ShippingStrategyActionType.UpdateAddressFailed, error, { methodId })
            ));
    }

    private _configureWallet(): Promise<void> {
        if (!this._methodId) {
            throw new MissingDataError(MissingDataErrorType.MissingPaymentMethod);
        }

        return this._store.dispatch(this._paymentMethodActionCreator.loadPaymentMethod(this._methodId))
            .then(state => {
                const paymentMethod = state.paymentMethods.getPaymentMethod(this._methodId);
                const storeConfig = state.config.getStoreConfig();

                if (!paymentMethod || !paymentMethod.clientToken || !paymentMethod.initializationData.gateway) {
                    throw new MissingDataError(MissingDataErrorType.MissingPaymentMethod);
                }

                if (!storeConfig) {
                    throw new MissingDataError(MissingDataErrorType.MissingCheckoutConfig);
                }

                this._paymentMethod = paymentMethod;
                const gateway = paymentMethod.initializationData.gateway;
                const testMode = paymentMethod.config.testMode;

                return Promise.all([
                    this._googlePayScriptLoader.load(),
                    this._googlePayPaymentProcessor.initialize(paymentMethod.clientToken, gateway), // TODO: Create googlePayCreateProcessor to support multiple gateway (approach TBD)
                ])
                    .then(([googlePay, googlePaymentInstance]) => {
                        this._googlePaymentsClient = this._getGooglePaymentsClient(googlePay, testMode);
                        this._googlePaymentInstance = googlePaymentInstance;
                    })
                    .catch((error: Error) => {
                        this._handleError(error);
                    });
            });
    }

    private _displayWallet(): Promise<InternalCheckoutSelectors> {
        return new Promise((resolve, reject) => {
            if (!this._paymentMethod) {
                throw new MissingDataError(MissingDataErrorType.MissingPaymentMethod);
            }

            if (GATEWAY.braintree === this._paymentMethod.initializationData.gateway) {
                if (!this._googlePaymentInstance && !this._googlePaymentsClient) {
                    throw new NotInitializedError(NotInitializedErrorType.PaymentNotInitialized);
                }

                this._googlePaymentsClient.isReadyToPay({
                    allowedPaymentMethods: this._googlePaymentInstance.createPaymentDataRequest().allowedPaymentMethods,
                }).then( (response: GooglePayIsReadyToPayResponse) => {
                    if (response) {
                        const paymentDataRequest: GooglePayBraintreePaymentDataRequest = this._googlePaymentInstance.createPaymentDataRequest(this._getGooglePayPaymentRequest()) as GooglePayBraintreePaymentDataRequest;

                        this._googlePaymentsClient.loadPaymentData(paymentDataRequest)
                            .then((paymentData: GooglePaymentData) => {
                                return this._setExternalCheckoutData(paymentData);
                            }).catch((err: GooglePaymentsError) => {
                            reject(new Error(err.statusCode));
                        });
                    }
                });
            }
        });
    }

    private _createOrder(payment: Payment, useStoreCredit?: boolean, options?: PaymentRequestOptions): Promise<InternalCheckoutSelectors> {
        return this._store.dispatch(this._orderActionCreator.submitOrder({ useStoreCredit }, options))
            .then(() => this._store.dispatch(this._paymentActionCreator.submitPayment(payment)));
    }

    private _getGooglePayPaymentRequest(): GooglePayPaymentDataRequest {
        const state = this._store.getState();
        const checkout = state.checkout.getCheckout();

        if (!checkout) {
            throw new MissingDataError(MissingDataErrorType.MissingCheckout);
        }
        const googlePaymentDataRequest: GooglePayPaymentDataRequest = {
            merchantInfo: {
                merchantId: 'your-merchant-id-from-google',
            },
            transactionInfo: {
                currencyCode: checkout.cart.currency.code,
                totalPriceStatus: 'FINAL',
                totalPrice: checkout.grandTotal.toString(),
            },
            cardRequirements: {
                // We recommend collecting billing address information, at minimum
                // billing postal code, and passing that billing postal code with all
                // Google Pay transactions as a best practice.
                billingAddressRequired: true,
                billingAddressFormat: 'FULL',
            },
            shippingAddressRequired: true,
            emailRequired: true,
            phoneNumberRequired: true,
        };

        return googlePaymentDataRequest;
    }

    private _getGooglePaymentsClient(google: GooglePaySDK, testMode: boolean | undefined): GooglePayClient {
        let environment: EnvironmentType;

        if (testMode === undefined) {
            throw new MissingDataError(MissingDataErrorType.MissingPaymentMethod);
        } else {
            if (testMode) {
                environment = 'PRODUCTION';
            } else {
                environment = 'TEST';
            }
        }

        const options: GooglePayPaymentOptions = { environment };

        return new google.payments.api.PaymentsClient(options) as GooglePayClient;
    }

    private _setExternalCheckoutData(paymentData: GooglePaymentData): Promise<void> {
        return this._googlePaymentInstance.parseResponse(paymentData)
            .then((tokenizePayload: TokenizePayload) => {
                const paymentSuccessPayload: PaymentSuccessPayload = {
                    tokenizePayload,
                    billingAddress: paymentData.cardInfo.billingAddress,
                    shippingAddress: paymentData.shippingAddress,
                    email: paymentData.email,
                };

                const {
                    onError = () => {},
                    onPaymentSelect = () => {},
                } = googlePayOptions;

                this._synchronizeBillingAddress();
                this._synchronizeShippingAddress();

                return this._paymentInstrumentSelected(paymentSuccessPayload)
                    .then(() => onPaymentSelect())
                    .catch(error => onError(error));
            });
    }

    private _paymentInstrumentSelected(paymentSuccessPayload: PaymentSuccessPayload): Promise<InternalCheckoutSelectors> {
        if (!this._paymentMethod) {
            throw new Error('Payment method not initialized');
        }

        const { id: methodId } = this._paymentMethod;

        return this._store.dispatch(this._paymentStrategyActionCreator.widgetInteraction(() => {
            return this._googlePayPaymentProcessor.handleSuccess(paymentSuccessPayload)
                .then(() => Promise.all([
                    this._store.dispatch(this._checkoutActionCreator.loadCurrentCheckout()),
                    this._store.dispatch(this._paymentMethodActionCreator.loadPaymentMethod(methodId)),
                ]));
        }, { methodId }), { queueId: 'widgetInteraction' });
    }

    private _handleError(error: Error): never {
        throw new StandardError(error.message);
    }

    private _getPayment() {
        return this._store.dispatch(this._paymentMethodActionCreator.loadPaymentMethod(this._methodId))
            .then(() => {
                const state = this._store.getState();
                const paymentMethod = state.paymentMethods.getPaymentMethod(this._methodId);

                if (!paymentMethod) {
                    throw new MissingDataError(MissingDataErrorType.MissingPaymentMethod);
                }

                if (!paymentMethod.initializationData.nonce) {
                    throw new MissingDataError(MissingDataErrorType.MissingPayment);
                }

                const paymentData = {
                    method: this._methodId,
                    nonce: paymentMethod.initializationData.nonce,
                    cardInformation: paymentMethod.initializationData.card_information,
                };

                this._paymentMethod = paymentMethod;

                return {
                    methodId: this._methodId,
                    paymentData,
                };
            });
    }

    @bind
    private _handleWalletButtonClick(event: Event): void {

        event.preventDefault();

        this._displayWallet();

    }
}
