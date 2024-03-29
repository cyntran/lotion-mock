import anyTest, { TestInterface } from 'ava'
import lotion = require('../src/index')
let test = anyTest as TestInterface<{ app: any }>

test.beforeEach(function(t) {
  let app = lotion({
    initialState: {
      count: 0,
      blockCount: 0
    }
  })

  app.use(function(state, transaction) {
    if (transaction.nonce === state.count) {
      state.count++
    }
  })

  app.useInitializer(function(state, copntext) {
    state.blockCount = 100
  })

  app.useBlock(function(state, context) {
    state.blockCount++
  })

  app.start()

  t.context = { app }
})

test('counter app with checkpointing', function(t) {
  let { app } = t.context
  let checkpoint = app.save()
  app.run([{ nonce: 0 }, { nonce: 1 }])
  t.is(app.state.count, 2)
  t.is(app.state.blockCount, 101)
  t.is(app.height, 2)
  app.load(checkpoint)
  t.is(app.height, 1)
  t.is(app.state.count, 0)
  t.is(app.state.blockCount, 100)
  app.run({ nonce: 0 })
  t.is(app.state.count, 1)
  // Make sure errors are safely handled
  app.run({ nonce: 20 })
  t.is(app.state.blockCount, 102)
  app.run({ nonce: 1 })
  t.is(app.state.blockCount, 103)
  t.is(app.state.count, 2)
})

test('counter app light client', async function(t) {
  let { app } = t.context
  let { send, state } = await lotion.connect(app)
  t.is(await state.count, 0)
  let result = await send({ nonce: 0 })
  t.true(result.ok)
  t.is(result.height, '2')
  let latestState = await state
  t.is(latestState.count, 1)
  result = await send({ nonce: 1000 })
  t.false(result.ok)
  t.is(result.height, '0')
  t.is(app.height, 3)
  t.is(await state.count, 1)
})
