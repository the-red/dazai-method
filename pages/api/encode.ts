import { createHandler } from '../../lib/api'

// 一人称の本音を受け取り、大きな主語に託した太宰メソッドの言い方に変換して返す
export default createHandler((dazai, 本音) => dazai.encode(本音))
