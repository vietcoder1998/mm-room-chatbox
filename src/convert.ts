import fs from 'fs'
import path from 'path'

export interface PureInfo {
  liquid: string
  meta: {
    [key: string]: any
  }
  context?: string
}

// move get context from liquid file with name
export async function getLiquidInfo(name: string): Promise<PureInfo> {
  const liquid = await fs
    .readFileSync(path.join(__dirname, 'data', `${name}.liquid`))
    .toString()

  const meta = JSON.parse(
    await fs
      .readFileSync(path.join(__dirname, 'data', `${name}.meta.json`))
      .toString()
  )

  return {
    liquid,
    meta
  }
}

// get context html
export async function getHtmlContext(name: string) {
  const context = await fs
    .readFileSync(path.join(__dirname, 'export', `${name}.html`))
    .toString()
  return {
    [name]: context
  }
}

// write context to html
export async function writeContext(
  name: string
): Promise<{ msg: string; code?: number }> {
  const { liquid, meta }: PureInfo = await getLiquidInfo(name)
  Object.values(liquid).forEach((vl: any) => {
    const context: string = convertLiquidAndMetaToContext(liquid, meta)
    const default_data: string = defaultTemplate(context)

    fs.writeFileSync(
      path.join(__dirname, 'export', `${name}.html`),
      default_data
    )
  })

  return { msg: 'success', code: 1 }
}

// map data into item,

export function convertLiquidAndMetaToContext(
  liquid: string,
  meta: { [key: string]: any }
): string {
  // replace sub Function with for and if function
  const sub_function: string = subFunctionLiquid({ liquid, meta })
  const sub_variable: string = subVariableLiquid({ liquid: sub_function, meta })

  return sub_variable
}

// convert liquid to product, example {{ product }}, product: "text is 12" => text is 12
export function subVariableLiquid({ liquid, meta }: PureInfo): string {
  let context: string = liquid.toString()

  // match with {{ name }}  in regex
  const regex = /(\{\{)((?:[^}]+))\}\}/g
  const list_match: string[] = liquid.match(regex) ?? []

  // match with {{ name }} in regex

  list_match.forEach((item) => {
    // get key from match , like : {{ product }} => 'product'
    const insideContent: string = getContentInCurlyBracket(item)
    const keys: string[] = insideContent.split('.')
    const metadata = getDataInMultiLevelObject(keys, meta)

    // replace value inside double bracket
    context = context.replace(
      item, // ex: {{ product }}
      // replace double bracket
      metadata // ex: {{ product }} => meta['product']
    )
  })

  return context
}

// get context inside match regex
export function getContentInsideMatchContext(
  [start, start_len]: [number, number],
  [end, end_len]: [number, number],
  context: string
): string {
  return context
    .slice(start + start_len, end + end_len)
    .split('{%- endfor -%}')
    .join('')
    .split('{%- endif -%}')
    .join('')
    .trim()
}

// check is function ( if | for)
export function isFunction(content: string): boolean {
  return (
    content.includes('if') ||
    (content.includes('for') && !content.includes('end'))
  )
}

export interface SearchMatchList {
  start: number
  len: number
  index: number
  content: string
  inside: string
  result: SearchMatchResult
}

export interface SearchMatchResult {
  value?: any
  type?: string
  breaker?: string[]
  deep?: {
    meta: any
    loop: any
  }
  refs?: string[]
  ref?: string
  render: string
}
// convert function to context
export function subFunctionLiquid({ liquid, meta }: PureInfo): string {
  let context: string = liquid.toString()
  const regex_fn = /(\{\%\-)(?:([^-]|([^-]$[^%]))+)(\-\%\})/g
  const list_match = liquid.match(regex_fn) ?? []

  // map regex info to data for convert
  const search_match: SearchMatchList[] = list_match.map(
    (content, index: number) => ({
      start: liquid.search(content),
      len: content.length,
      index,
      content,
      inside: '',
      result: breakFunctionContext(content, meta)
    })
  )

  // match if and for function
  const convert_content_list: [SearchMatchList, SearchMatchList][] =
    matchFunctionInSearchMatch(search_match, context)
  /// new context is [{typeof search_match }, {typeof search_match }][], should return destroy map

  // push value into convert context list for destroyer

  // destroy context with array params
  const nContext: string = replaceContext(convert_content_list, context)

  return nContext
}

// map value if else splice ata to
/// receive list of result, output is [[input, right], [input, output], [input, output], [left, right]]
// ex: [1, 2,3 4] =>[[1, 4], [2, 3]]
export function matchFunctionInSearchMatch(
  arr: SearchMatchList[],
  context: string
): [any, any][] {
  const len: number = arr.length

  if (len % 2 === 1) {
    return []
  }
  const result: [SearchMatchList, SearchMatchList][] = []

  arr.forEach((elm, i) => {
    const left = elm
    const right = arr[i + 1]

    if (i % 2 === 0) {
      // right inside
      left.inside = getContentInsideMatchContext(
        [left.start, left.len],
        [right.start, right.len],
        context
      )
      //

      console.log(left.inside)
      switch (left.result.type) {
        case 'for':
          left.result.refs = convertDataWithForContent(
            left.inside,
            left.result.deep?.loop
          )

          // render
          left.result.render = render(left.result.refs)
          break

        case 'if':
          left.result.ref = subVariableLiquid({
            liquid: left.inside,
            meta: left.result?.deep?.meta
          })

          // render
          left.result.render = render(left.result.ref)
          break

        default:
          break
      }

      // convert loop to content

      // add right and left
      result.push([left, right])
    }
  })

  // map inside to into new context, like for will return list of div
  return result
}

// render
export function render(refs: string | string[]) {
  if (typeof refs === 'string') {
    return refs
  } else {
    return refs.join('\n')
  }
}

// break function liquid context
export function breakFunctionContext(
  liquid: string,
  meta: object
): SearchMatchResult {
  // transform {%- [text] -%} into [string, string, ...args:[]] to check typing
  let breaker = liquid
    .split('{%-')
    .join('')
    .split('-%}')
    .join('')
    .split(' ')
    .filter((item) => item !== '')

  // breaker[0] is typeof function
  const type = breaker[0]

  /// ex: if || for
  switch (type) {
    case 'if':
      // get result of operator
      return {
        value: valueOperatorWithIf(
          trueValue(breaker[1], meta),
          breaker[2],
          trueValue(breaker[3], meta)
        ),
        type,
        deep: {
          loop: [],
          meta
        },
        breaker,
        refs: [],
        render: ''
      }
    case 'for':
      const value = valueOperatorWithFor(
        trueValue(breaker[1], meta, 'for'),
        breaker[2],
        trueValue(breaker[3], meta)
      )
      return {
        value,
        type,
        deep: {
          meta: {
            [breaker[1]]: trueValue(breaker[1], meta)
          },
          loop: value.data?.map((data: any) => ({ [breaker[1]]: data }))
        },
        refs: [],
        breaker,
        render: ''
      }
    default:
      return {
        value: null,
        type,
        deep: {
          meta: {},
          loop: []
        },
        refs: [],
        breaker,
        render: ''
      }
  }
}

// map for with data context
export function convertDataWithForContent(ref: string, metas: any[]): string[] {
  const result = metas.map((meta: any) => {
    return subVariableLiquid({ liquid: ref, meta })
  })


  return result
}

// input and output
// remove context with if, for
/// ex: start: { value: true, type: if, index: 12, len: 8}, end: {value: true, type: if, index: 12, len: 8}]
function convertLeftRightToArrayDestroy(
  left: SearchMatchList,
  right: SearchMatchList
): [number, number][] {
  let result: [number, number][] = []

  switch ([left?.result?.type, right?.result.type]) {
    case ['if', 'endif']:
      if (left.result?.value) {
        result = [
          [left.start, left.start + left.len],
          [right.start, right.start + right.len]
        ]
      } else {
        result = [[left.start, right.start + right.len]]
      }
      break
    case ['for', 'endfor']:
      if (left.result?.value) {
        result = [
          [left.start, left.start + left.len],
          [right.start, right.start + right.len]
        ]
      } else {
        result = [[left.start, right.start + right.len]]
      }
      break

    default:
      break
  }
  return result
}

// receive a input array string, destroy if exist in context, receive in context
function replaceContext(
  params: [SearchMatchList, SearchMatchList][],
  context: string
) {
  let n_context = context.toString()

  for (let i = params.length - 1; i >= 0; i--) {
    const element = params[i]
    const p1: SearchMatchList = element[0]
    const p2: SearchMatchList = element[1]
    const mover = n_context.substring(p1.index, p2.index + p2.len)
    context.replace(mover, p1?.result?.render)
  }

  return n_context
}

// check variable in function, if a number or string, return it, it is object, checking and return to value
/// ex: meta: { foo: {bar: 1}}, name: foo, return meta.foo; name: "Jon"; name: 1 return 1
/// ex: name: foo => ['foo']
/// foo.baz => ['foo', 'baz]
// convert value in function to rich value
function trueValue(name: string, meta: Object, type?: string) {
  if (type == 'for') {
    return name
  }

  if (parseInt(name)) {
    return name
  }

  // check if contain "" like: "Jon"
  if (name.includes('"')) {
    return name.split('"').join('')
  } else {
    const tree_keys = name.split('.')
    let rs = getDataInMultiLevelObject(tree_keys, meta)

    return rs
  }
}

// double curly bracket
function getContentInCurlyBracket(data: string) {
  const sub_space = data.slice(2, -2).trim().toString()
  return sub_space
}

// function bracket
function get_content_in_fn_bracket(data: string) {
  const sub_space = data.slice(3, -3).trim().toString()
  return sub_space
}

// operator support is more than >=, less than <=, equal: ==
// switch value function with operator
// type IfOperator = '>=' | "<=" | "=="
function valueOperatorWithIf<T>(vl1: T, op: string, vl2: T) {
  switch (op) {
    case '<=':
      return vl1 <= vl2
    case '==':
      return vl1 === vl2
    case '>=':
      return vl1 >= vl2
    case '!=':
      return vl1 !== vl2
    default:
      return false
  }
}

// type IfOperator = '>=' | "<=" | "=="
function valueOperatorWithFor<T>(vl1: any, op: string, vl2: any) {
  if (op === 'in') {
    return {
      name: vl1,
      data: vl2
    }
  } else {
    throw new Error('Error with for')
  }
}

// update map to object typing
/// create tree_object
function TreeObject(
  parent: Object,
  key: string,
  value: any,
  type: 'in' | 'out'
) {
  if (type === 'out') {
    Object.assign(parent, {
      [key]: value
    })
  } else {
    return {
      ...parent
    }
  }
}

/// ex: const x = { a: {b: {foo: baz}}} => getDataInMultiLevelObject([a, b], x) => result : {foo: baz}
function getDataInMultiLevelObject(
  keys: string[],
  target: { [key: string]: any }
): any {
  const len = keys.length
  let result: any = null
  let temp = 0

  while (temp < len) {
    let key = keys[temp]
    if (target[key]) {
      result = target[key]
      target = target[key]
    } else {
      result = null
      break
    }

    temp++
  }

  return result
}

export function defaultTemplate(data: string) {
  return `<DOCTYPE !html>
            <html>
                <header>
                </header>
                <body>
                    ${data}
                </body>
            <html>
    `
}
