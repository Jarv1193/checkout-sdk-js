import { PaymentStrategy } from '../';
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
    PaymentMethodData,
} from './googlepay';
import GooglePayPaymentInitializeOptions from './googlepay-initialize-options';
import GooglePayPaymentProcessor from './googlepay-payment-processor';

export default class GooglePayPaymentStrategy extends PaymentStrategy {
    private _googlePayOptions?: GooglePayPaymentInitializeOptions;
    private _methodId?: string;
    private _walletButton?: HTMLElement;
    private _googlePaymentDataRequest!: GooglePayPaymentDataRequestV1;

    constructor(
        store: CheckoutStore,
        private _checkoutActionCreator: CheckoutActionCreator,
        private _paymentMethodActionCreator: PaymentMethodActionCreator,
        private _paymentStrategyActionCreator: PaymentStrategyActionCreator,
        private _paymentActionCreator: PaymentActionCreator,
        private _orderActionCreator: OrderActionCreator,
        private _googlePayPaymentProcessor: GooglePayPaymentProcessor
    ) {
        super(store);
    }

    initialize(options: PaymentInitializeOptions): Promise<InternalCheckoutSelectors> {
        const { methodId, googlepay: googlePayOptions } = options;

        this._googlePayOptions = options.googlepay;

        return this._googlePayPaymentProcessor.initialize(this._methodId)
            .then(() => {
                if (!options.googlepay) {
                    throw new InvalidArgumentError('Unable to initialize payment because "options.googlepay" argument is not provided.');
                }

                const walletButton = options.googlepay.walletButton && document.getElementById(options.googlepay.walletButton);

                if (walletButton) {
                    this._walletButton = walletButton;
                    this._walletButton.addEventListener('click', this._handleWalletButtonClick);
                }

                return super.initialize(options);
            });
    }

    deinitialize(options?: PaymentRequestOptions): Promise<InternalCheckoutSelectors> {
        if (this._walletButton) {
            this._walletButton.removeEventListener('click', this._handleWalletButtonClick);
        }

                const gateway = this._paymentMethod.initializationData.gateway;

        return Promise.all([
            this._googlePayPaymentProcessor.deinitialize(),
        ]).then(() => super.deinitialize(options));
    }

    execute(payload: OrderRequestBody, options?: PaymentRequestOptions): Promise<InternalCheckoutSelectors> {
        if (!this._googlePayOptions) {
            throw new InvalidArgumentError('Unable to initialize payment because "options.googlepay" argument is not provided.');
        }

        const {
            onError = () => {},
            onPaymentSelect = () => {},
        } = this._googlePayOptions;

        return Promise.resolve(this._getPayment())
            .then(payment => {
                if (!payment.paymentData.nonce || !payment.paymentData.cardInformation) {
                    return this._googlePayPaymentProcessor.displayWallet()
                        .then(paymentData => this._paymentInstrumentSelected(paymentData))
                        .then(() => onPaymentSelect())
                        .then(() => this._getPayment())
                        .catch(error => {
                            if (error.statusCode !== 'CANCELED') {
                                onError(error);
                            }
                        });
                }

                return payment;
            })
            .then(payment =>
                this._store.dispatch(this._orderActionCreator.submitOrder({ useStoreCredit: payload.useStoreCredit }, options))
                    .then(() => this._store.dispatch(this._paymentActionCreator.submitPayment(this._getPayment())))
            );
    }

    private _paymentInstrumentSelected(paymentData: GooglePaymentData) {
        if (!this._methodId) {
            throw new NotInitializedError(NotInitializedErrorType.PaymentNotInitialized);
        }

        const methodId = this._methodId;

        return this._googlePayPaymentProcessor.handleSuccess(paymentData)
            .then(() => Promise.all([
                this._store.dispatch(this._checkoutActionCreator.loadCurrentCheckout()),
                this._store.dispatch(this._paymentMethodActionCreator.loadPaymentMethod(methodId)),
            ]));
    }

    private _getPayment(): PaymentMethodData {
        if (!this._methodId) {
            throw new NotInitializedError(NotInitializedErrorType.PaymentNotInitialized);
        }

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
    private _handleWalletButtonClick(event: Event): Promise<InternalCheckoutSelectors> {
        event.preventDefault();

        if (!this._methodId || !this._googlePayOptions) {
            throw new NotInitializedError(NotInitializedErrorType.PaymentNotInitialized);
        }

        const methodId = this._methodId;

        const {
            onError = () => {},
            onPaymentSelect = () => {},
        } = this._googlePayOptions;

        return this._store.dispatch(this._paymentStrategyActionCreator.widgetInteraction(() => {
            return this._googlePayPaymentProcessor.displayWallet()
                .then(paymentData => this._paymentInstrumentSelected(paymentData))
                .then(() => onPaymentSelect())
                .catch(error => {
                    if (error.statusCode !== 'CANCELED') {
                        onError(error);
                    }
                });
        }, { methodId }), { queueId: 'widgetInteraction' });
    }
}
