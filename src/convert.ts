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
export async function get_liquid_info(name: string): Promise<PureInfo> {
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
export async function get_html_context(name: string) {
  const context = await fs
    .readFileSync(path.join(__dirname, 'export', `${name}.html`))
    .toString()
  return {
    [name]: context
  }
}

// write context to html
export async function write_context(
  name: string
): Promise<{ msg: string; code?: number }> {
  const { liquid, meta }: PureInfo = await get_liquid_info(name)
  Object.values(liquid).forEach((vl) => {
    const context: string = convertLiquidAndMetaToContext(liquid, meta)
    const default_data: string = default_template(context)

    fs.writeFileSync(
      path.join(__dirname, 'export', `${name}.html`),
      default_data
    )
  })

  return { msg: 'success', code: 1 }
}

export function convertLiquidAndMetaToContext(
  liquid: string,
  meta: { [key: string]: any }
): string {
  // replace sub Function with for and if function
  const sub_function: string = subFunctionLiquid({ liquid, meta })

  // replace variable liquid with variable
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
  return context.slice(start + start_len, end + end_len)
}

// check is function ( if | for)
export function isFunction(content: string): boolean {
  return (
    content.includes('if') ||
    (content.includes('for') && !content.includes('end'))
  )
}

// convert function to context
export function subFunctionLiquid({ liquid, meta }: PureInfo): string {
  let context: string = liquid.toString()
  const regex_fn = /(\{\%\-)((?:([^-]|([^-]$[^%]))+))-\%\})/g
  const list_match = liquid.match(regex_fn) ?? []

  // map regex info to data for convert
  const search_match: {
    start: number
    len: number
    index: number
    content: string
    inside: string
    result: any
  }[] = list_match.map((content, index: number) => ({
    start: liquid.search(content),
    len: context.length,
    index,
    content,
    inside: '',
    result: breakFunctionContext(context, meta)
  }))

  for (let i = 0; i < search_match.length - 1; i++) {
    const now = search_match[i]
    const next = search_match[i]

    now.inside = isFunction(now.content)
      ? getContentInsideMatchContext(
          [now.index, now.len],
          [next.index, next.len],
          context
        )
      : ''
  }

  //
  const list_type: string[] = search_match.map((m) => m.result?.type)

  // match if and for function
  const convert_content_list: [any, any][] =
    matchFunctionInSearchMatch(search_match)

  /// new context is [{typeof search_match }, {typeof search_match }][], should return destroy map
  const destroy_context_list: [number, number][] = []

  // push value into convert context list for destroyer
  convert_content_list.forEach((content) => {
    const left = content[0]
    const right = content[1]

    if (left && right) {
      // left 
      Object.assign(left, {
        type: left?.result?.type,
        value: left?.result.value
      })

      // right
      Object.assign(right, {
        type: right?.result?.type,
        value: right?.result?.value
      })

      // copy typing into result
      const value: [number, number][] = context_destroyer(left, right)
      value?.forEach((vl: [number, number]) => destroy_context_list.push(vl))
    }
  })

  // destroy context with array params
  const nContext: string = destroy_context(destroy_context_list, context)

  return nContext
}

// map value if else splice ata to
/// receive list of result, output is [[input, right], [input, output], [input, output], [left, right]]
// ex: [1, 2,3 4] =>[[1, 4], [2, 3]]
export function matchFunctionInSearchMatch(
  search_match: {
    start: number
    len: number
    index: number
    content: string,
    inside: string,
    result: {
      value: any
      type: string
    }
  }[]
) {
  const result: [any, any][] = []
  const len = search_match.length

  if (len % 2 === 1) {
    return []
  }
  search_match.forEach((vl, i) => {
    if (vl && i % 2 === 0) {
      // add right and left
      result.push([search_match[i], search_match[i + 1]])
    }
  })
  return result
}

// break function liquid context
export function breakFunctionContext(
  liquid: string,
  meta: object
): { value: any; type: string } {
  // transform {%- [text] -%} into [string, string, ...args:[]] to check typing
  let breaker = liquid
    .split('{%-')
    .join('')
    .split('-%}')
    .join('')
    .split(' ')
    .filter((item) => item !== '')
  const type = breaker[0]

  // breaker[0] is typeof function
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
        type
      }
    case 'for':
      return {
        value: valueOperatorWithFor(
          trueValue(breaker[1], meta, 'for'),
          breaker[2],
          trueValue(breaker[3], meta)
        ),
        type
      }
    default:
      return {
        value: {},
        type
      }
  }
}

// input and output
// remove context with if, for
/// ex: start: {value: true, type: if, index: 12, len: 8}, end: {value: true, type: if, index: 12, len: 8}]
function context_destroyer(
  left: { type: string; len: number; value: any; start: number },
  right: { type: string; len: number; value: any; start: number }
): Array<[number, number]> {
  let result: [number, number][] = []
  if (left?.type === 'if' && right?.type === 'endif') {
    if (left.value) {
      result = [
        [left.start, left.start + left.len],
        [right.start, right.start + right.len]
      ]
    } else {
      result = [[left.start, right.start + right.len]]
    }
  }

  return result
}

// receive a input array string, destroy array
function destroy_context(params: [number, number][], context: string) {
  let n_context = context.toString()
  for (let i = params.length - 1; i >= 0; i--) {
    const element = params[i]
    const p1 = element[0]
    const p2 = element[1]
    const mover = n_context.substring(p1, p2)
    n_context = n_context.split(mover).join('')
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
    console.log('result is', rs)
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
  console.log(vl1, op, vl2)
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

export function default_template(data: string) {
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
