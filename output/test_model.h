#ifndef TEST_MODEL_H
#define TEST_MODEL_H

#include <stdbool.h>
#include <stddef.h>

typedef struct test_model_state {
  double node_outputs[256];
  double node_internal_state[256];
  int state_machine_active_state[256];
  double state_machine_elapsed_ms[256];
  double state_machine_prev_event_input[256];
} test_model_state;

void test_model_init(test_model_state* state);
void test_model_step(test_model_state* state, double step_time_sec);

#endif /* TEST_MODEL_H */
