"""Fine-tune a capital-account field extractor on Tinker.

Requires TINKER_API_KEY (sign up at https://auth.thinkingmachines.ai/sign-up,
create a key at https://tinker-console.thinkingmachines.ai) and the
tinker-cookbook package installed:

    pip install tinker-cookbook

Generate training data first:

    python ml/generate_data.py

Then run:

    python ml/train_extractor.py
    # or override the base model:
    python ml/train_extractor.py --model_name Qwen/Qwen3-8B

This mirrors tinker_cookbook/recipes/sl_basic.py, pointed at our own
JSONL dataset instead of NoRobots. Only the assistant turn (the JSON
extraction) is trained on -- the system/user turns are the statement text,
which we don't want the model learning to reproduce.
"""

import asyncio
import sys
from pathlib import Path

import chz
from tinker_cookbook import cli_utils
from tinker_cookbook.renderers import TrainOnWhat
from tinker_cookbook.supervised import train
from tinker_cookbook.supervised.data import FromConversationFileBuilder
from tinker_cookbook.supervised.types import ChatDatasetBuilderCommonConfig

DEFAULT_MODEL_NAME = "Qwen/Qwen3-8B"
DATA_DIR = Path(__file__).parent / "data"


def build_config_blueprint(model_name: str = DEFAULT_MODEL_NAME) -> chz.Blueprint[train.Config]:
    # Force thinking off: we want a direct JSON completion, not a reasoning
    # trace, and eval_extractor.py assumes the same renderer at inference time.
    renderer_name = "qwen3_disable_thinking"
    common_config = ChatDatasetBuilderCommonConfig(
        model_name_for_tokenizer=model_name,
        renderer_name=renderer_name,
        max_length=4096,
        batch_size=32,
        train_on_what=TrainOnWhat.ALL_ASSISTANT_MESSAGES,
    )
    dataset = FromConversationFileBuilder(
        common_config=common_config,
        file_path=str(DATA_DIR / "train.jsonl"),
        test_size=0,  # val.jsonl is our held-out set, scored separately by eval_extractor.py
    )
    return chz.Blueprint(train.Config).apply(
        {
            "log_path": "/tmp/tinker-examples/capital_account_extractor",
            "model_name": model_name,
            "recipe_name": "recipe_capital_account_extractor",
            "renderer_name": renderer_name,
            "dataset_builder": dataset,
            "learning_rate": 1e-4,
            "lr_schedule": "linear",
            "num_epochs": 3,
            "lora_rank": 32,
            "save_every": 50,
        }
    )


def main(config: train.Config):
    cli_utils.check_log_dir(config.log_path, behavior_if_exists="ask")
    asyncio.run(train.main(config))


if __name__ == "__main__":
    if not (DATA_DIR / "train.jsonl").exists():
        sys.exit("No training data found. Run `python ml/generate_data.py` first.")
    model_name = cli_utils.model_name_from_argv(sys.argv[1:], default=DEFAULT_MODEL_NAME)
    blueprint = build_config_blueprint(model_name)
    blueprint.make_from_argv(sys.argv[1:])
    main(blueprint.make())
