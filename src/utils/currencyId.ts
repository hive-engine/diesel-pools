import { Currency, Token } from '@uniswap/sdk'
import {SWAPHIVE} from 'constants/index'

export function currencyId(currency: Currency): string {
  if (currency === SWAPHIVE) return 'SWAP.HIVE'
  if (currency instanceof Token) return currency.address
  throw new Error('invalid currency')
}
