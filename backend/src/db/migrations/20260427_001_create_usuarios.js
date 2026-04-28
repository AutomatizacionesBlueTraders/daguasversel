exports.up = async function (knex) {
  await knex.schema.createTable('usuarios', (t) => {
    t.increments('id').primary();
    t.string('email', 255).notNullable().unique();
    t.string('nombre', 255).notNullable();
    t.string('telefono', 50);
    t.string('password_hash', 255); // null mientras el usuario no haya definido contraseña
    t.enum('rol', ['admin', 'usuario', 'tecnico']).notNullable().defaultTo('usuario');
    t.boolean('activo').notNullable().defaultTo(true);
    t.boolean('email_verificado').notNullable().defaultTo(false);
    t.boolean('debe_cambiar_password').notNullable().defaultTo(false);
    t.timestamp('ultimo_login');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    t.index('email');
    t.index('rol');
    t.index('activo');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('usuarios');
};
