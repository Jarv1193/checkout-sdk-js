import {Cart} from '../../../cart';
import { Checkout } from '../../../checkout';
import {Coupon} from '../../../coupon';
import { GiftCertificate } from '../../../coupon';
import {Customer} from '../../../customer';
import {Discount} from '../../../discount';
import {Consignment} from '../../../shipping';
import {Tax} from '../../../tax';
import PaymentMethod from '../../payment-method';
import PaymentMethodConfig from '../../payment-method-config';

import {
    GooglePaymentData,
    GooglePayAddress,
    GooglePayBraintreeSDK,
    GooglePayPaymentDataRequestV1,
    GooglePaySDK
} from './googlepay';
import OrderRequestBody from "../../../order/order-request-body";

export function getGooglePaySDKMock(): GooglePaySDK {
    return {
        payments: jest.fn(),
    };
}

export function getGoogleOrderRequestBody(): OrderRequestBody {
    return {
        useStoreCredit: true,
    };
}
