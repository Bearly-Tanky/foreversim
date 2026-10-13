package database

import (
	"os"
	"strings"
	"testing"
	"text/template"
)

// Renders the real tsTemplateStr the same way generateTsFile does and compares it
// against the checked-in ui/sim/talents/<class>.ts files.
func TestTalentsTsTemplateMatchesCheckedInFiles(t *testing.T) {
	classes := []string{"Druid", "Hunter", "Mage", "Paladin", "Priest", "Rogue", "Shaman", "Warlock", "Warrior"}
	tmpl := template.Must(template.New("tsTemplate").Parse(tsTemplateStr))

	for _, c := range classes {
		data := ClassData{ClassName: c, LowerCaseClassName: strings.ToLower(c)}
		// mirror generateTsFile's mutations
		data.ClassName = strings.ReplaceAll(data.ClassName, "_", "")
		data.FileName = data.LowerCaseClassName
		data.LowerCaseClassName = strings.ReplaceAll(data.LowerCaseClassName, "_", "")

		var sb strings.Builder
		if err := tmpl.Execute(&sb, data); err != nil {
			t.Fatalf("%s: %v", c, err)
		}
		want, err := os.ReadFile("../../ui/sim/talents/" + strings.ToLower(c) + ".ts")
		if err != nil {
			t.Fatalf("%s: %v", c, err)
		}
		if sb.String() != string(want) {
			t.Errorf("%s mismatch:\n--- generated ---\n%s\n--- checked in ---\n%s", c, sb.String(), string(want))
		}
	}
}
