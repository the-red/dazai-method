import { createHandler } from '../../lib/api'

// 太宰メソッド（世間を主語にした発言）を受け取り、主語を本人に戻した切り返しを返す
export default createHandler((dazai, seken) => dazai.decode(seken))
