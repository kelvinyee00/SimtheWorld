#include "test_model.h"
#include <math.h>

void test_model_init(test_model_state* state) {
  if (state == NULL) return;
  for (int i = 0; i < 256; i++) {
    state->node_outputs[i] = 0.0;
    state->node_internal_state[i] = 0.0;
    state->state_machine_active_state[i] = 0;
    state->state_machine_elapsed_ms[i] = 0.0;
    state->state_machine_prev_event_input[i] = 0.0;
  }
  state->node_internal_state[0] = 0.000000;
}

void test_model_step(test_model_state* state, double step_time_sec) {
  if (state == NULL) return;
  double step_ms = step_time_sec > 0.0 ? step_time_sec * 1000.0 : 0.0;

  /* node[0] id=counter type=counter */
  state->node_outputs[0] = state->node_internal_state[0];
  state->node_internal_state[0] += 1.000000;

  /* node[1] id=gain type=gain */
  state->node_outputs[1] = state->node_outputs[0] * 2.000000;

}
