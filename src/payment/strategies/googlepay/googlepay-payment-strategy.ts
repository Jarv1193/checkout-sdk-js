import { RequestSender, Response } from '@bigcommerce/request-sender';

import {
    PaymentActionCreator,
    PaymentMethodActionCreator,
    PaymentStrategyActionCreator
} from '../..';
import { InternalCheckoutSelectors } from '../../../checkout';
import { CheckoutActionCreator, CheckoutStore } from '../../../checkout';
import { NotInitializedError } from '../../../common/error/errors';
import {
    InvalidArgumentError,
    MissingDataError,
    MissingDataErrorType,
    NotInitializedErrorType,
} from '../../../common/error/errors';
import { toFormUrlEncoded } from '../../../common/http-request';
import { bindDecorator as bind } from '../../../common/utility';
import {
    OrderActionCreator,
    OrderRequestBody
} from '../../../order';
import Payment from '../../payment';
import {
    PaymentInitializeOptions,
    PaymentRequestOptions
} from '../../payment-request-options';
import PaymentStrategy from '../payment-strategy';

import {
    GooglePaymentData,
    GooglePayAddress,
    GooglePayClient,
    GooglePayInitializer,
    GooglePayPaymentDataRequestV1,
    PaymentMethodData,
    TokenizePayload,
} from './googlepay';
import GooglePayPaymentInitializeOptions from './googlepay-initialize-options';
import GooglePayPaymentProcessor from './googlepay-payment-processor';

export default class GooglePayPaymentStrategy extends PaymentStrategy {
    private _googlePaymentsClient!: GooglePayClient;
    private _googlePayOptions!: GooglePayPaymentInitializeOptions;
    private _methodId!: string;
    private _walletButton?: HTMLElement;
    private _googlePaymentDataRequest!: GooglePayPaymentDataRequestV1;

    constructor(
        store: CheckoutStore,
        private _checkoutActionCreator: CheckoutActionCreator,
        private _paymentMethodActionCreator: PaymentMethodActionCreator,
        private _paymentStrategyActionCreator: PaymentStrategyActionCreator,
        private _paymentActionCreator: PaymentActionCreator,
        private _orderActionCreator: OrderActionCreator,
        private _googlePayInitializer: GooglePayInitializer,
        private _requestSender: RequestSender,
        private _googlePayPaymentProcessor: GooglePayPaymentProcessor
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

        return this._googlePayPaymentProcessor.initialize(this._methodId)
            .then(() => super.initialize(options));
    }

                this._paymentMethod = state.paymentMethods.getPaymentMethod(methodId);

                if (!this._paymentMethod || !this._paymentMethod.clientToken || !this._paymentMethod.initializationData.gateway) {
                    throw new MissingDataError(MissingDataErrorType.MissingPaymentMethod);
                }

                const gateway = this._paymentMethod.initializationData.gateway;

        return Promise.all([
            this._googlePayInitializer.teardown(),
            this._googlePayPaymentProcessor.deinitialize(),
        ]).then(() => super.deinitialize(options));
    }

    execute(payload: OrderRequestBody, options?: PaymentRequestOptions): Promise<InternalCheckoutSelectors> {
        return this._createOrder(this._getPayment(), payload.useStoreCredit, options);
    }

    private _createOrder(payment: Payment, useStoreCredit?: boolean, options?: PaymentRequestOptions): Promise<InternalCheckoutSelectors> {
        return this._store.dispatch(this._orderActionCreator.submitOrder({ useStoreCredit }, options))
            .then(() => this._store.dispatch(this._paymentActionCreator.submitPayment(payment)));
    }

    private _setExternalCheckoutData(paymentData: GooglePaymentData): Promise<void> {
        return this._googlePayPaymentProcessor.parseResponse(paymentData)
            .then((tokenizePayload: TokenizePayload) => {
                const {
                    onError = () => {},
                    onPaymentSelect = () => {},
                } = googlePayOptions;

                this._synchronizeBillingAddress();
                this._synchronizeShippingAddress();

                return this._paymentInstrumentSelected(tokenizePayload, paymentData.cardInfo.billingAddress)
                    .then(() => onPaymentSelect())
                    .catch(error => onError(error));
            });
    }

    private _paymentInstrumentSelected(tokenizePayload: TokenizePayload, billingAddress: GooglePayAddress): Promise<InternalCheckoutSelectors> {
        if (!this._methodId) {
            throw new NotInitializedError(NotInitializedErrorType.PaymentNotInitialized);
        }

        return this._store.dispatch(this._paymentStrategyActionCreator.widgetInteraction(() => {
            return this._postForm(tokenizePayload, billingAddress);
        }, { methodId: this._methodId }), { queueId: 'widgetInteraction' });
    }

    private _postForm(postPaymentData: TokenizePayload, billingAddress: GooglePayAddress): Promise<void> {
        const cardInformation = postPaymentData.details;

        return this._requestSender.post('/checkout.php', {
            headers: {
                Accept: 'text/html',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: toFormUrlEncoded({
                payment_type: postPaymentData.type,
                nonce: postPaymentData.nonce,
                provider: this._methodId,
                action: 'set_external_checkout',
                card_information: this._getCardInformation(cardInformation),
            }),
        }).then(() => {
            if (!this._methodId) {
                throw new NotInitializedError(NotInitializedErrorType.PaymentNotInitialized);
            }

            return Promise.all([
                this._googlePayPaymentProcessor.updateBillingAddress(billingAddress),
                this._store.dispatch(this._checkoutActionCreator.loadCurrentCheckout()),
                this._store.dispatch(this._paymentMethodActionCreator.loadPaymentMethod(this._methodId)),
            ]).then(() => this._store.getState());
        });
    }

    private _getCardInformation(cardInformation: { cardType: string, lastFour: string }) {
        return {
            type: cardInformation.cardType,
            number: cardInformation.lastFour,
        };
    }

    private _getPayment(): PaymentMethodData {
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

        return {
            methodId: this._methodId,
            paymentData,
        };
    }

    @bind
    private _handleWalletButtonClick(event: Event): Promise<void> {
        event.preventDefault();

        return this._googlePayPaymentProcessor.displayWallet()
            .then(paymentData => this._setExternalCheckoutData(paymentData));
    }
}
