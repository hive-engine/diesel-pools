import { LEO, BEE, WORKERBEE, DEC, PAL, SWAPHIVE, IHiveToken, IHiveTokenMetadata } from './../constants/index';
//import { ChainId } from '@uniswap/sdk';
import { TokenList, TokenInfo } from '@uniswap/token-lists'
import schema from '@uniswap/token-lists/src/tokenlist.schema.json'
import Ajv from 'ajv'
import contenthashToUri from './contenthashToUri'
import { parseENSAddress } from './parseENSAddress'
import uriToHttp from './uriToHttp'
import {ssc} from 'utils/ssc'

const tokenListValidator = new Ajv({ allErrors: true }).compile(schema)

/**
 * Contains the logic for resolving a list URL to a validated token list
 * @param listUrl list url
 * @param resolveENSContentHash resolves an ens name to a contenthash
 */
export default async function getTokenList(
  listUrl: string,
  resolveENSContentHash: (ensName: string) => Promise<string>
): Promise<TokenList> {
  console.log(listUrl);
  if (listUrl !== "hive-engine.list") {
    const parsedENS = parseENSAddress(listUrl)
    let urls: string[]
    if (parsedENS) {
      let contentHashUri
      try {
        contentHashUri = await resolveENSContentHash(parsedENS.ensName)
      } catch (error) {
        console.debug(`Failed to resolve ENS name: ${parsedENS.ensName}`, error)
        throw new Error(`Failed to resolve ENS name: ${parsedENS.ensName}`)
      }
      let translatedUri
      try {
        translatedUri = contenthashToUri(contentHashUri)
      } catch (error) {
        console.debug('Failed to translate contenthash to URI', contentHashUri)
        throw new Error(`Failed to translate contenthash to URI: ${contentHashUri}`)
      }
      urls = uriToHttp(`${translatedUri}${parsedENS.ensPath ?? ''}`)
    } else {
      urls = uriToHttp(listUrl)
    }
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i]
      const isLast = i === urls.length - 1
      let response
      try {
        response = await fetch(url)
      } catch (error) {
        console.debug('Failed to fetch list', listUrl, error)
        if (isLast) throw new Error(`Failed to download list ${listUrl}`)
        continue
      }

      if (!response.ok) {
        if (isLast) throw new Error(`Failed to download list ${listUrl}`)
        continue
      }

      const json = await response.json()
      if (!tokenListValidator(json)) {
        const validationErrors: string =
          tokenListValidator.errors?.reduce<string>((memo, error) => {
            const add = `${error.dataPath} ${error.message ?? ''}`
            return memo.length > 0 ? `${memo}; ${add}` : `${add}`
          }, '') ?? 'unknown error'
        throw new Error(`Token list failed validation: ${validationErrors}`)
      }
      return json
    }
    throw new Error('Unrecognized list URL protocol.')
  } else {
    let heTokens: any[] = await loadTokens([], 1000, 0);    
    let tokens = heTokens.map(x => { 
          let dpToken: TokenInfo = {
            address: "0x" + randHex(40),
            chainId: 1,
            name: x.name,
            decimals: x.precision,
            symbol: x.symbol,
            logoURI: x.metadata.icon,
            tags: [""]
          };

          setDefaultAddresses(dpToken);
          
          return dpToken;
      })

    let ti : TokenList = {
      name: 'Hive-Engine Tokens',      
      timestamp: '',
      version: {
        major: 1,
        minor: 0,
        patch: 0
      },
      tokens: tokens
    }

    return ti;
  }
}

export function setDefaultAddresses(dpToken:TokenInfo) {
  switch (dpToken.symbol) {
    case "PAL":
      dpToken.address = PAL.address;
      break;
    case "LEO":
      dpToken.address = LEO.address;
      break;
    case "BEE":
      dpToken.address = BEE.address;
      break;
    case "WORKERBEE":
      dpToken.address = WORKERBEE.address;
      break;
    case "DEC":
      dpToken.address = DEC.address;
      break;
    case "SWAP.HIVE":
        dpToken.address = SWAPHIVE.address;
        break;
  }    
}

export function randHex(len: number) {
  var maxlen = 8,
      min = Math.pow(16,Math.min(len,maxlen)-1),
      max = Math.pow(16,Math.min(len,maxlen)) - 1,
      n   = Math.floor( Math.random() * (max-min+1) ) + min,
      r   = n.toString(16);
  while ( r.length < len ) {
     r = r + randHex( len - maxlen );
  }
  return r;
};

export async function loadTokens(symbols = [], limit = 50, offset = 0): Promise<any[]> {
    const disabledTokens = (process.env.REACT_APP_HE_DISABLED_TOKENS as string).split(',');
    const queryConfig: any = {};

    if (symbols.length) {
        queryConfig.symbol = { $in: symbols };
    }

    const results: any[] = await ssc.find('tokens', 'tokens', queryConfig, limit, offset, [{ index: 'symbol', descending: false }]);
    let tokens: IHiveToken[] = [];

    for (const res of results) {
      console.log(disabledTokens);
       if (disabledTokens.includes(res.symbol)) {
         continue;
       }
      //if (res.symbol != "SWAP.HIVE")
        tokens.push(mapTokenResultToIToken(res));
    }

    return tokens;
}

export function mapTokenResultToIToken(token: any) {
  let mapped : IHiveToken = {
      _id: token._id,
      circulatingSupply: token.circulatingSupply,        
      maxSupply: token.maxSupply,
      metadata: mapMetadataToTokenMetadata(token.metadata),
      name: token.name,
      precision: token.precision,        
      supply: token.supply,
      symbol: token.symbol,
      isCrypto: false
  }

  return mapped;
}

export function mapMetadataToTokenMetadata(metadata: any) {
  let metadataParsed = JSON.parse(metadata);

  let mapped: IHiveTokenMetadata = {
      desc: metadataParsed.desc,
      icon: metadataParsed.icon,
      url: metadataParsed.url
  };

  return mapped;
}