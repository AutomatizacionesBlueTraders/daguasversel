exports.up = async function (knex) {
  await knex.schema.createTable('password_reset_tokens', (t) => {
    t.increments('id').primary();
    t.integer('usuario_id').unsigned().notNullable()
      .references('id').inTable('usuarios').onDelete('CASCADE');
    t.string('token_hash', 64).notNullable().unique();
    t.string('code_hash', 64);
    t.integer('attempts').notNullable().defaultTo(0);
    t.timestamp('expires_at').notNullable();
    t.timestamp('used_at');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.index('usuario_id');
    t.index('expires_at');
  });

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_pwreset_code_hash
      ON password_reset_tokens (code_hash)
      WHERE code_hash IS NOT NULL AND used_at IS NULL
  `);
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_pwreset_code_hash');
  await knex.schema.dropTableIfExists('password_reset_tokens');
};
